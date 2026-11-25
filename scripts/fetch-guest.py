"""Provision the pinned CPython guest into the ignored runtime directory."""

import hashlib
import os
import tempfile
import urllib.request
from pathlib import Path

image = Path(__file__).resolve().parents[1] / "runtime/python.wasm"
image.parent.mkdir(exist_ok=True)
expected = "e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763"


def provision():
    if image.exists() and hashlib.sha256(image.read_bytes()).hexdigest() == expected:
        return
    url = "https://github.com/vmware-labs/webassembly-language-runtimes/releases/download/python/3.12.0%2B20231211-040d5a6/python-3.12.0.wasm"
    with tempfile.NamedTemporaryFile(dir=image.parent, delete=False) as temp:
        path = Path(temp.name)
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                temp.write(response.read(40 * 1024 * 1024))
            temp.close()
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError("Guest digest mismatch")
            os.replace(path, image)
        finally:
            temp.close()
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    provision()
