"""Private API for the separately deployed WASI host."""

import hmac
import os
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from backend.execution import local_case

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class Case(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    source: str = Field(max_length=16000)
    stdin: str = Field(max_length=32000)


@app.post("/case")
def run(body: Case, x_runner_token: str = Header(default="")):
    key = os.getenv("MATRIX_RUNNER_TOKEN", "")
    if len(key) < 32 or not hmac.compare_digest(key, x_runner_token):
        raise HTTPException(403, "Unavailable")
    if len(body.source.encode()) > 16000:
        raise HTTPException(413, "Submission too large")
    return local_case(body.source, body.stdin)
