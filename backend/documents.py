import hashlib
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import boto3
from botocore.config import Config
from celery import Celery
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import Field

from .access import Strict, actor, recruiter
from .extraction import ResumeFacts, validate_container
from .store import ROOT, RUNTIME, db, now, uid
from .workspace import application, require

router = APIRouter()
LIMIT = 5 * 1024 * 1024
MIMES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
celery = Celery(
    "documents",
    broker=os.getenv("REDIS_URL")
    or "sqla+sqlite:///" + (RUNTIME / "queue.sqlite3").as_posix(),
)
celery.conf.update(
    task_ignore_result=True,
    task_serializer="json",
    accept_content=["json"],
    worker_prefetch_multiplier=1,
    task_time_limit=120,
    task_soft_time_limit=100,
    broker_connection_retry_on_startup=True,
)
BUCKET = os.getenv("S3_BUCKET", "interviewmatrix-private")


def storage():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT", "http://127.0.0.1:18333"),
        config=Config(
            connect_timeout=3, read_timeout=15, retries={"total_max_attempts": 2}
        ),
        region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    )


def scan(blob):
    target = os.getenv("CLAMD_HOST")
    if not target:
        if os.name != "nt":
            raise ValueError("Scanner unavailable")
        # Use the existing OS scanner. Never run or open the uploaded document.
        executable = (
            Path(os.environ["ProgramFiles"]) / "Windows Defender" / "MpCmdRun.exe"
        )
        with tempfile.TemporaryDirectory(dir=RUNTIME) as tmp:
            path = Path(tmp) / "quarantine.bin"
            path.write_bytes(blob)
            result = subprocess.run(
                [
                    str(executable),
                    "-Scan",
                    "-ScanType",
                    "3",
                    "-File",
                    str(path),
                    "-DisableRemediation",
                ],
                capture_output=True,
                timeout=50,
            )
            if result.returncode or not path.exists():
                raise ValueError("Scan rejected")
        return
    with socket.create_connection(
        (target, int(os.getenv("CLAMD_PORT", "3310"))), timeout=15
    ) as conn:
        conn.sendall(b"zINSTREAM\0")
        for pos in range(0, len(blob), 65536):
            chunk = blob[pos : pos + 65536]
            conn.sendall(struct.pack(">I", len(chunk)) + chunk)
        conn.sendall(b"\0" * 4)
        if conn.recv(512).strip(b"\0\r\n") != b"stream: OK":
            raise ValueError("Scan rejected")


def mark(key, gen, status, facts=None, warnings=None):
    with db(True) as c:
        if c.execute(
            "UPDATE resume SET status=?,facts=?,warnings=? WHERE id=? AND generation=? AND status!='deleting'",
            (status, json.dumps(facts), json.dumps(warnings or []), key, gen),
        ).rowcount:
            c.execute(
                "INSERT INTO processing_event(resume,generation,status,at) VALUES(?,?,?,?)",
                (key, gen, status, now()),
            )


@celery.task(bind=True, max_retries=2, name="matrix.extract")
def process(self, key, gen):
    with db(True) as c:
        row = c.execute(
            "SELECT * FROM resume WHERE id=? AND generation=? AND status IN ('queued','retrying')",
            (key, gen),
        ).fetchone()
        if not row:
            return
        c.execute("UPDATE resume SET status='processing' WHERE id=?", (key,))
        c.execute(
            "INSERT INTO processing_event(resume,generation,status,at) VALUES(?,?,'processing',?)",
            (key, gen, now()),
        )
    try:
        blob = (
            storage()
            .get_object(Bucket=BUCKET, Key=row["object_key"])["Body"]
            .read(LIMIT + 1)
        )
        if len(blob) > LIMIT or hashlib.sha256(blob).hexdigest() != row["checksum"]:
            raise ValueError("Invalid object")
        scan(blob)
        env = {
            k: v
            for k, v in os.environ.items()
            if k.upper()
            in {
                "SYSTEMROOT",
                "WINDIR",
                "PATH",
                "TEMP",
                "TMP",
                "LANG",
                "TESSDATA_PREFIX",
            }
        }
        child = subprocess.run(
            [sys.executable, "-m", "backend.parse_document", row["format"], key],
            input=blob,
            capture_output=True,
            timeout=85,
            cwd=ROOT,
            env=env,
        )
        if child.returncode:
            raise ValueError("Parser rejected input")
        facts, warnings = json.loads(child.stdout)
        facts = ResumeFacts.model_validate(facts).model_dump()
        mark(key, gen, "needs_review" if warnings else "ready", facts, warnings)
    except (ValueError, zipfile.BadZipFile):
        mark(
            key,
            gen,
            "failed",
            warnings=["Document validation, scanning or extraction failed."],
        )
    except Exception:
        if self.request.retries < 2:
            mark(key, gen, "retrying")
            raise self.retry(countdown=5 * (self.request.retries + 1))
        mark(key, gen, "failed", warnings=["Processing service unavailable."])


def enqueue(key, gen):
    try:
        process.delay(key, gen)
    except Exception:
        mark(key, gen, "failed", warnings=["Queue unavailable"])
        raise HTTPException(503, "Document stored. Retry processing later.")


@router.post("/applications/{app}/resume-consent")
def allow_recruiter_upload(app: str, user=Depends(actor)):
    with db(True) as c:
        application(c, app, user)
        if user["role"] != "candidate":
            raise HTTPException(403, "Candidate consent required")
        c.execute(
            "INSERT INTO resume_consent VALUES(?,?,?) ON CONFLICT(application) DO UPDATE SET actor=excluded.actor,at=excluded.at",
            (app, user["id"], now()),
        )
    return {"allowed": True}


@router.post("/applications/{app}/resumes")
async def upload(app: str, request: Request, user=Depends(actor)):
    with db() as c:
        a = application(c, app, user)
        if (
            user["role"] == "recruiter"
            and not c.execute(
                "SELECT 1 FROM resume_consent WHERE application=?", (app,)
            ).fetchone()
        ):
            raise HTTPException(403, "Candidate must authorize recruiter upload")
    if request.headers.get("x-resume-consent") != "review-v1":
        raise HTTPException(422, "Consent required")
    fmt = MIMES.get(request.headers.get("content-type", ""))
    if not fmt or not request.headers.get("x-file-extension", "").lower() == fmt:
        raise HTTPException(415, "PDF or DOCX required")
    blob = bytearray()
    async for chunk in request.stream():
        if len(blob) + len(chunk) > LIMIT:
            raise HTTPException(413, "Maximum upload is 5 MiB")
        blob.extend(chunk)
    try:
        validate_container(blob, fmt)
    except (ValueError, zipfile.BadZipFile, RuntimeError):
        raise HTTPException(422, "Invalid document")
    checksum = hashlib.sha256(blob).hexdigest()
    with db(True) as c:
        previous = c.execute(
            "SELECT id,status,object_key,generation,expires FROM resume WHERE application=? AND checksum=?",
            (app, checksum),
        ).fetchone()
        if previous and (
            previous["expires"] <= now() or previous["status"] == "deleting"
        ):
            raise HTTPException(410, "Document expired")
        if previous and previous["status"] != "upload_failed":
            return {"id": previous["id"], "status": previous["status"]}
        if previous:
            key, object_key, gen = (
                previous["id"],
                previous["object_key"],
                previous["generation"] + 1,
            )
            c.execute(
                "UPDATE resume SET status='uploading',generation=?,warnings=NULL WHERE id=?",
                (gen, key),
            )
        else:
            key, gen = uid(), 1
            object_key = f"{a['org']}/{key}.{fmt}"
            c.execute(
                "INSERT INTO resume(id,application,object_key,checksum,format,consent,created,expires,status) VALUES(?,?,?,?,?,'review-v1',?,?,'uploading')",
                (key, app, object_key, checksum, fmt, now(), now() + 90 * 86400),
            )
        c.execute(
            "INSERT INTO processing_event(resume,generation,status,at) VALUES(?,?,'uploading',?)",
            (key, gen, now()),
        )
    try:
        storage().put_object(
            Bucket=BUCKET,
            Key=object_key,
            Body=bytes(blob),
            ContentType=request.headers["content-type"],
        )
    except Exception:
        mark(
            key,
            gen,
            "upload_failed",
            warnings=["Storage unavailable. Upload this file again."],
        )
        raise HTTPException(503, "Private document storage unavailable")
    with db(True) as c:
        queued = c.execute(
            "UPDATE resume SET status='queued' WHERE id=? AND generation=? AND status='uploading'",
            (key, gen),
        ).rowcount
        if queued:
            c.execute(
                "INSERT INTO processing_event(resume,generation,status,at) VALUES(?,?,'queued',?)",
                (key, gen, now()),
            )
        else:
            existing = c.execute(
                "SELECT status FROM resume WHERE id=?", (key,)
            ).fetchone()
    if not queued:
        if not existing or existing["status"] == "deleting":
            storage().delete_object(Bucket=BUCKET, Key=object_key)
        raise HTTPException(409, "Upload superseded")
    enqueue(key, gen)
    return {"id": key, "status": "queued"}


def scoped(c, key, user):
    r = require(c.execute("SELECT * FROM resume WHERE id=?", (key,)).fetchone())
    application(c, r["application"], user)
    return r


@router.get("/applications/{app}/resumes")
def documents(app: str, user=Depends(actor)):
    with db() as c:
        application(c, app, user)
        return [
            dict(r)
            for r in c.execute(
                "SELECT id,status,format,created,expires FROM resume WHERE application=? AND expires>? ORDER BY created DESC LIMIT 100",
                (app, now()),
            )
        ]


@router.get("/resumes/{key}")
def read(key: str, user=Depends(actor)):
    with db() as c:
        r = scoped(c, key, user)
        if r["expires"] <= now() or r["status"] == "deleting":
            raise HTTPException(410, "Document expired")
        return {
            "id": key,
            "status": r["status"],
            "facts": json.loads(r["facts"] or "null"),
            "warnings": json.loads(r["warnings"] or "[]"),
            "corrections": [
                dict(x)
                for x in c.execute(
                    "SELECT field,value,reason,at FROM correction WHERE resume=? AND generation=? ORDER BY at",
                    (key, r["generation"]),
                )
            ],
        }


@router.get("/resumes/{key}/original")
def original(key: str, user=Depends(actor)):
    with db() as c:
        r = scoped(c, key, user)
    if r["status"] not in ("ready", "needs_review") or r["expires"] <= now():
        raise HTTPException(409, "Original unavailable")
    body = (
        storage().get_object(Bucket=BUCKET, Key=r["object_key"])["Body"].read(LIMIT + 1)
    )
    if hashlib.sha256(body).hexdigest() != r["checksum"]:
        raise HTTPException(409, "Object changed")
    return Response(
        body,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="resume.{r["format"]}"'},
    )


class Correction(Strict):
    field: str
    value: str = Field(min_length=1, max_length=1000)
    reason: str = Field(min_length=1, max_length=500)


@router.post("/resumes/{key}/corrections")
def correct(key: str, body: Correction, user=Depends(recruiter)):
    with db(True) as c:
        r = scoped(c, key, user)
        if (
            body.field not in ResumeFacts.model_fields
            or r["status"] not in ("ready", "needs_review")
            or r["expires"] <= now()
        ):
            raise HTTPException(409, "Correction unavailable")
        c.execute(
            "INSERT INTO correction VALUES(?,?,?,?,?,?,?,?)",
            (
                uid(),
                key,
                r["generation"],
                user["id"],
                body.field,
                body.value,
                body.reason,
                now(),
            ),
        )
    return {"saved": True}


@router.post("/resumes/{key}/retry")
def retry(key: str, user=Depends(actor)):
    with db(True) as c:
        r = scoped(c, key, user)
        if r["status"] == "deleting" or r["expires"] <= now():
            raise HTTPException(410, "Document unavailable")
        if r["status"] == "upload_failed":
            raise HTTPException(409, "Upload the original file again")
        if r["status"] in ("uploading", "queued", "processing", "retrying"):
            return {"status": r["status"]}
        gen = r["generation"] + 1
        c.execute(
            "UPDATE resume SET status='queued',generation=?,facts=NULL,warnings=NULL WHERE id=?",
            (gen, key),
        )
        c.execute(
            "INSERT INTO processing_event(resume,generation,status,at) VALUES(?,?,'queued',?)",
            (key, gen, now()),
        )
    enqueue(key, gen)
    return {"status": "queued"}


def purge(key):
    with db(True) as c:
        r = c.execute("SELECT object_key FROM resume WHERE id=?", (key,)).fetchone()
        if not r:
            return
        c.execute(
            "DELETE FROM evaluation WHERE application=(SELECT application FROM resume WHERE id=?)",
            (key,),
        )
        c.execute("UPDATE resume SET status='deleting',facts=NULL WHERE id=?", (key,))
    storage().delete_object(Bucket=BUCKET, Key=r["object_key"])
    with db(True) as c:
        c.execute("DELETE FROM resume WHERE id=?", (key,))


@router.delete("/resumes/{key}")
def remove(key: str, user=Depends(actor)):
    with db() as c:
        scoped(c, key, user)
    purge(key)
    return {"deleted": True}


@celery.task(name="matrix.retention")
def retention():
    with db(True) as c:
        c.execute("DELETE FROM evaluation WHERE expires<=?", (now(),))
        c.execute("DELETE FROM provider_call WHERE at<?", (now() - 90 * 86400,))
    with db() as c:
        keys = [
            r[0]
            for r in c.execute(
                "SELECT id FROM resume WHERE expires<=? OR status='deleting'", (now(),)
            )
        ]
    for key in keys:
        purge(key)


@celery.task(name="matrix.recover")
def recover_stale():
    with db(True) as c:
        stale = c.execute(
            """SELECT r.id,r.generation,r.status FROM resume r WHERE r.status IN ('uploading','queued','processing','retrying') AND
            COALESCE((SELECT max(at) FROM processing_event e WHERE e.resume=r.id AND e.generation=r.generation),r.created)<?""",
            (now() - 900,),
        ).fetchall()
        for r in stale:
            c.execute(
                "UPDATE resume SET status=?,generation=generation+1,warnings=? WHERE id=?",
                (
                    "upload_failed" if r["status"] == "uploading" else "failed",
                    json.dumps(
                        [
                            "Upload expired. Upload the original file again."
                            if r["status"] == "uploading"
                            else "Processing expired. Reprocess the saved document."
                        ]
                    ),
                    r["id"],
                ),
            )


@celery.task(name="matrix.heartbeat")
def heartbeat():
    with db(True) as c:
        c.execute(
            "INSERT INTO worker_status VALUES(1,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at",
            (now(),),
        )


celery.conf.beat_schedule = {
    "worker-heartbeat": {"task": "matrix.heartbeat", "schedule": 60},
    "daily-retention": {"task": "matrix.retention", "schedule": 86400},
    "expired-jobs": {"task": "matrix.recover", "schedule": 300},
}
