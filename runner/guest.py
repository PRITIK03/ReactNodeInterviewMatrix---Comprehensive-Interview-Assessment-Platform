"""Dedicated WASI host. Only the pinned CPython guest interprets candidate text."""

import hashlib
import json
import signal
import sys
import tempfile
from pathlib import Path

import wasmtime as wasm

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763"
POLICY = "cp312-wasmtime51-wasip1-v2"
OUTPUT_LIMIT = 16384


def execute(source, stdin):
    binary = (ROOT / "runtime/python.wasm").read_bytes()
    if hashlib.sha256(binary).hexdigest() != IMAGE:
        raise ValueError("Runner image failed verification")
    config = wasm.Config()
    config.consume_fuel = True
    engine = wasm.Engine(config)
    module = wasm.Module(engine, binary)
    linker = wasm.Linker(engine)
    linker.define_wasi()
    store = wasm.Store(engine)
    store.set_limits(memory_size=96 * 1024 * 1024, instances=1)
    store.set_fuel(1_500_000_000)
    out, err = bytearray(), bytearray()
    overflow = False

    def capture(buf, chunk):
        nonlocal overflow
        if len(chunk) + len(buf) > OUTPUT_LIMIT:
            overflow = True
        buf.extend(chunk[: max(0, OUTPUT_LIMIT - len(buf))])
        return len(chunk)

    wasi = wasm.WasiConfig()
    wasi.argv = ["python", "-B", "-S", "-c", source]
    wasi.env = [("PYTHONHASHSEED", "0"), ("PYTHONIOENCODING", "utf-8")]
    # Preview 1: no preopened sockets, directories, inherited env or descriptors.
    with tempfile.TemporaryDirectory() as tmp:
        stream = Path(tmp) / "input"
        stream.write_bytes(stdin.encode())
        wasi.stdin_file = str(stream)
        native_output = sys.platform.startswith("linux")
        if native_output:
            # Keep native WASI shutdown independent of CPython callback finalizers.
            # These handles are private to this guest. No directory is preopened.
            import resource

            stdout_path, stderr_path = Path(tmp) / "out", Path(tmp) / "err"
            wasi.stdout_file = str(stdout_path)
            wasi.stderr_file = str(stderr_path)
            soft, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
            limit = min(
                [OUTPUT_LIMIT + 1]
                + [v for v in (soft, hard) if v != resource.RLIM_INFINITY]
            )
            resource.setrlimit(resource.RLIMIT_FSIZE, (limit, hard))
            signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
        else:
            wasi.stdout_custom = lambda chunk: capture(out, chunk)
            wasi.stderr_custom = lambda chunk: capture(err, chunk)
        store.set_wasi(wasi)
        instance = linker.instantiate(store, module)
        status = "finished"
        try:
            instance.exports(store)["_start"](store)
        except wasm.ExitTrap as exc:
            if exc.code:
                status = "runtime_error"
        except wasm.Trap as exc:
            status = (
                "time_limit"
                if exc.trap_code == wasm.TrapCode.OUT_OF_FUEL
                else "runtime_error"
            )
        finally:
            store.close()
        if native_output:
            with stdout_path.open("rb") as output:
                capture(out, output.read(OUTPUT_LIMIT + 1))
            with stderr_path.open("rb") as errors:
                capture(err, errors.read(OUTPUT_LIMIT + 1))
        if status == "runtime_error":
            if b"MemoryError" in err:
                status = "memory_limit"
            elif b"SyntaxError" in err or b"IndentationError" in err:
                status = "compilation_error"
    if overflow:
        status = "output_limit"
    return {
        "status": status,
        "stdout": out.decode(errors="replace"),
        "engine": POLICY + "/" + IMAGE,
    }


if __name__ == "__main__":
    request = json.load(sys.stdin)
    print(json.dumps(execute(request["source"], request["stdin"])))
