from typing import Literal
from fastapi import APIRouter, Depends, Request
from pydantic import Field
from .access import Strict, candidate_user, recruiter
from .evaluation_service import generate, load_card, review
from .store import db, now
from .workspace import application

router = APIRouter()


class Generate(Strict):
    scope: Literal["resume", "assessment", "combined"] = "combined"
    provider: Literal["local", "gemini"] = "local"


class Review(Strict):
    revision: int = Field(ge=0)
    criterion: str | None = None
    action: Literal[
        "accept", "override", "note", "review_complete", "request_information"
    ]
    value: int | None = None
    reason: str = Field(min_length=1, max_length=800, pattern=r"\S")


class Permission(Strict):
    allowed: bool


@router.put("/applications/{key}/evaluation-permission")
def permission(key: str, body: Permission, user=Depends(candidate_user)):
    with db(True) as c:
        application(c, key, user)
        c.execute("DELETE FROM evaluation_permission WHERE application=?", (key,))
        if body.allowed:
            c.execute(
                "INSERT INTO evaluation_permission VALUES(?,?,?)",
                (key, user["id"], now()),
            )
    return {"allowed": body.allowed}


@router.post("/applications/{key}/evaluations")
def create(key: str, body: Generate, request: Request, user=Depends(recruiter)):
    return generate(key, user, body.scope, body.provider, request.state.correlation)


@router.get("/applications/{key}/evaluations")
def history(key: str, user=Depends(recruiter)):
    with db() as c:
        application(c, key, user)
        return [
            dict(r)
            for r in c.execute(
                "SELECT id,scope,provider,created FROM evaluation WHERE application=? AND expires>? ORDER BY created DESC,id DESC LIMIT 50",
                (key, now()),
            )
        ]


@router.get("/evaluations/{eid}")
def card(eid: str, user=Depends(recruiter)):
    with db() as c:
        return load_card(c, eid, user)


@router.post("/evaluations/{eid}/review")
def decide(eid: str, body: Review, user=Depends(recruiter)):
    return review(eid, user, body)
