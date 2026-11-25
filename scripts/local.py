"""Start the loopback-only portfolio workspace. Ctrl+C stops owned children."""

import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]


def main():
    runtime = ROOT / "runtime"
    objects = runtime / "objects"
    objects.mkdir(parents=True, exist_ok=True)
    frontend = ROOT / "frontend/my-react-app"
    data = runtime / "logs"
    data.mkdir(exist_ok=True)
    # Each launch generates private S3 credentials. Never pass these to the browser.
    base = {
        **os.environ,
        "PYTHONPATH": str(ROOT),
        "DATABASE_URL": "",
        "MATRIX_RUNNER_ENDPOINT": "",
        "S3_ENDPOINT": "http://127.0.0.1:18333",
        "AWS_ACCESS_KEY_ID": secrets.token_hex(12),
        "AWS_SECRET_ACCESS_KEY": secrets.token_urlsafe(32),
        "AWS_DEFAULT_REGION": "us-east-1",
        "S3_BUCKET": "interviewmatrix-private",
    }
    children = []
    handles = []

    def spawn(name, args, cwd=ROOT, env=base):
        f = (data / (name + ".log")).open("ab")
        handles.append(f)
        p = subprocess.Popen(
            list(map(str, args)),
            cwd=cwd,
            env=env,
            stdout=f,
            stderr=f,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        children.append((name, p))

    for port in [5173, 8000, 18333, 9333, 8080, 8888]:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", port))
    try:
        spawn(
            "storage",
            [
                runtime / "seaweed/weed.exe",
                "mini",
                "-ip=127.0.0.1",
                "-ip.bind=127.0.0.1",
                "-admin.ui=false",
                "-webdav=false",
                "-s3.port=18333",
                "-dir=" + str(objects),
                "-bucket=" + base["S3_BUCKET"],
            ],
            objects,
        )
        client = boto3.client(
            "s3",
            endpoint_url=base["S3_ENDPOINT"],
            aws_access_key_id=base["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=base["AWS_SECRET_ACCESS_KEY"],
            region_name="us-east-1",
            config=Config(
                connect_timeout=1, read_timeout=1, retries={"max_attempts": 0}
            ),
        )
        for _ in range(60):
            if children[0][1].poll() is not None:
                raise RuntimeError("Storage stopped; inspect runtime/logs/storage.log")
            try:
                client.head_bucket(Bucket=base["S3_BUCKET"])
                break
            except Exception:
                time.sleep(1)
        else:
            raise RuntimeError("Private storage did not become ready")
        spawn(
            "api",
            [
                sys.executable,
                "-m",
                "uvicorn",
                "backend.main:app",
                "--host",
                "127.0.0.1",
                "--no-access-log",
            ],
        )
        spawn(
            "documents",
            [
                sys.executable,
                "-m",
                "celery",
                "-A",
                "backend.documents:celery",
                "worker",
                "--pool=solo",
                "--concurrency=1",
                "--without-gossip",
                "--without-mingle",
                "--without-heartbeat",
                "--loglevel=WARNING",
            ],
        )
        spawn(
            "retention",
            [
                sys.executable,
                "-m",
                "celery",
                "-A",
                "backend.documents:celery",
                "beat",
                "-s",
                runtime / "retention-schedule",
                "--loglevel=WARNING",
            ],
        )
        spawn(
            "web",
            [
                shutil.which("node"),
                frontend / "node_modules/vite/bin/vite.js",
                "--host",
                "127.0.0.1",
                "--strictPort",
            ],
            frontend,
            os.environ.copy(),
        )
        print("InterviewMatrix: http://127.0.0.1:5173   (Ctrl+C to stop)", flush=True)
        while True:
            for name, p in children:
                if p.poll() is not None:
                    raise RuntimeError(
                        name + " stopped. Inspect runtime/logs/" + name + ".log"
                    )
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for _, p in reversed(children):
            if p.poll() is None:
                p.terminate()
        for _, p in children:
            p.wait()
        for f in handles:
            f.close()


if __name__ == "__main__":
    main()
