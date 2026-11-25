"""Private worker entry point. Pipe document bytes through a bounded-time parser."""

import json
import sys

from .extraction import extract

if __name__ == "__main__":
    fmt, key = sys.argv[1:]
    try:
        facts, warnings = extract(sys.stdin.buffer.read(5 * 1024 * 1024 + 1), fmt, key)
        print(json.dumps([facts, warnings]))
    except Exception:
        sys.exit(2)
