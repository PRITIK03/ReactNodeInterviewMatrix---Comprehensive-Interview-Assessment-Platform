"""Adapter to the dedicated WASI host. Never interpret submissions in this process."""

import json
import os
import subprocess
import sys
import threading
import urllib.request

from .store import ROOT

slots = threading.BoundedSemaphore(2)


def run_case(source, stdin):
    endpoint = os.getenv("MATRIX_RUNNER_ENDPOINT")
    if not endpoint:
        return local_case(source, stdin)
    token = os.environ["MATRIX_RUNNER_TOKEN"]
    request = urllib.request.Request(
        endpoint,
        data=json.dumps({"source": source, "stdin": stdin}).encode(),
        headers={"Content-Type": "application/json", "X-Runner-Token": token},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read(96000))


def local_case(source, stdin):
    env = {
        k: v
        for k, v in os.environ.items()
        if k.upper()
        in {
            "SYSTEMROOT",
            "WINDIR",
            "TEMP",
            "TMP",
            "TMPDIR",
            "PATH",
            "LANG",
            "PROCESSOR_ARCHITECTURE",
            "PROCESSOR_ARCHITEW6432",
        }
    }
    if not slots.acquire(timeout=2):
        raise RuntimeError("Runner busy")
    try:
        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(ROOT / "runner/guest.py")],
                input=json.dumps({"source": source, "stdin": stdin}),
                capture_output=True,
                encoding="utf8",
                env=env,
                timeout=15,
                cwd=ROOT / "runner",
                check=True,
            )
        except subprocess.TimeoutExpired:
            return {
                "status": "time_limit",
                "stdout": "",
                "engine": "cp312-wasmtime51-wasip1-v2/wall",
            }
    finally:
        slots.release()
    return json.loads(proc.stdout)
