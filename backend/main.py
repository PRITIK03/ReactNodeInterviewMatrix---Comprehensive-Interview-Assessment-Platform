"""Run from the repository root: python -m uvicorn backend.main:app"""

import os
import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import access, advice, assessments, documents, workspace, evaluation_api
from .store import initialize, db, uid, now


@asynccontextmanager
async def lifespan(app):
    initialize()
    yield


app = FastAPI(title="InterviewMatrix", version="1", lifespan=lifespan)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.getenv("MATRIX_HOSTS", "127.0.0.1,localhost").split(","),
)


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    return JSONResponse(
        {"detail": [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]}, 422
    )


@app.middleware("http")
async def same_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if (
        request.method not in ("GET", "HEAD", "OPTIONS")
        and origin
        and origin
        != (os.getenv("MATRIX_PUBLIC_ORIGIN") or str(request.base_url).rstrip("/"))
    ):
        return JSONResponse({"detail": "Cross-origin mutation refused"}, 403)
    is_upload = request.method == "POST" and request.url.path.rstrip("/").endswith(
        "/resumes"
    )
    if request.method in ("POST", "PATCH", "PUT", "DELETE") and not is_upload:
        size = 0
        data = bytearray()
        async for chunk in request.stream():
            size += len(chunk)
            if size > 600000:
                return JSONResponse({"detail": "Request too large"}, 413)
            data.extend(chunk)
        request._body = bytes(data)
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


@app.middleware("http")
async def observe(request: Request, call_next):
    request.state.correlation = uid()
    started = time.monotonic()
    error_type = None
    try:
        response = await call_next(request)
    except Exception as exc:
        error_type = type(exc).__name__
        response = JSONResponse(
            {"detail": "Internal error", "request_id": request.state.correlation}, 500
        )
    response.headers["X-Request-ID"] = request.state.correlation
    response.headers["Referrer-Policy"] = "no-referrer"
    route = request.scope.get("route")
    logging.getLogger("uvicorn.error").info(
        json.dumps(
            {
                "event": "http",
                "error_type": error_type,
                "request_id": request.state.correlation,
                "route": getattr(route, "path", "unmatched"),
                "status": response.status_code,
                "latency_ms": round((time.monotonic() - started) * 1000),
            }
        )
    )
    return response


for module in (access, assessments, workspace, documents, advice, evaluation_api):
    app.include_router(module.router, prefix="/api/v1")


@app.get("/api/health")
def health():
    with db() as c:
        c.execute("SELECT id FROM organization LIMIT 1").fetchone()
    return {"status": "ok", "database": "reachable"}


@app.get("/api/v1/operations")
def operations(user=Depends(access.recruiter)):
    with db() as c:
        calls = [
            dict(r)
            for r in c.execute(
                "SELECT status,latency_ms,input_tokens,output_tokens,cost_usd FROM provider_call WHERE org=? ORDER BY at DESC LIMIT 50",
                (user["org"],),
            )
        ]
        documents_state = [
            dict(r)
            for r in c.execute(
                "SELECT r.status,count(*) AS count FROM resume r JOIN application a ON a.id=r.application JOIN candidate p ON p.id=a.candidate WHERE p.org=? GROUP BY r.status",
                (user["org"],),
            )
        ]
        executions = [
            dict(r)
            for r in c.execute(
                "SELECT t.status,count(*) AS count FROM test_case_result t JOIN execution_run e ON e.id=t.run JOIN code_submission s ON s.id=e.submission JOIN assessment_attempt x ON x.id=s.attempt JOIN invitation i ON i.id=x.invitation JOIN application a ON a.id=i.application JOIN candidate p ON p.id=a.candidate WHERE p.org=? GROUP BY t.status",
                (user["org"],),
            )
        ]
        pulse = c.execute("SELECT at FROM worker_status WHERE id=1").fetchone()
    return {
        "provider_calls": calls,
        "document_status": documents_state,
        "case_verdicts": executions,
        "worker_recent": bool(pulse and pulse[0] > now() - 180),
    }
