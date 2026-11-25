import os
import hashlib
import hmac
import re
import secrets
from typing import Literal

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .store import db, digest, now, uid

router = APIRouter()


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Credentials(Strict):
    email: str = Field(max_length=254)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        return normalize_email(v)


def normalize_email(value):
    value = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
        raise ValueError("Invalid email")
    return value


class Registration(Credentials):
    role: Literal["candidate", "recruiter"] = "candidate"
    organization: str = Field(default="", max_length=100)


def derive(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1).hex()


def actor(matrix_session: str | None = Cookie(default=None)):
    with db() as c:
        row = c.execute(
            "SELECT a.id,a.role,a.org,a.email FROM account a JOIN session s ON s.user=a.id WHERE s.token=? AND s.expires>?",
            (digest(matrix_session or ""), now()),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Please sign in")
    return dict(row)


def recruiter(user=Depends(actor)):
    if user["role"] != "recruiter":
        raise HTTPException(403, "Recruiter access required")
    return user


def candidate_user(user=Depends(actor)):
    if user["role"] != "candidate":
        raise HTTPException(403, "Candidate access required")
    return user


def limit_auth(request: Request):
    # Store only a digest of the peer address, expire the bucket after five minutes.
    peer = digest(request.client.host if request.client else "local")
    with db(True) as c:
        c.execute("DELETE FROM auth_window WHERE until<=?", (now(),))
        row = c.execute(
            "SELECT hits FROM auth_window WHERE client=?", (peer,)
        ).fetchone()
        if row and row["hits"] >= 45:
            raise HTTPException(429, "Please try again in five minutes")
        c.execute(
            "INSERT INTO auth_window VALUES(?,?,1) ON CONFLICT(client) DO UPDATE SET hits=auth_window.hits+1",
            (peer, now() + 300),
        )


class Profile(Strict):
    name: str = Field(default="", max_length=120)
    headline: str = Field(default="", max_length=240)


@router.get("/profile")
def own_profile(user=Depends(candidate_user)):
    with db() as c:
        row = c.execute(
            "SELECT name,headline FROM profile WHERE owner=?", (user["id"],)
        ).fetchone()
        return dict(row) if row else {"name": "", "headline": ""}


@router.put("/profile")
def update_profile(body: Profile, user=Depends(candidate_user)):
    with db(True) as c:
        c.execute(
            "INSERT INTO profile VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET name=excluded.name,headline=excluded.headline",
            (user["id"], body.name.strip(), body.headline.strip()),
        )
    return {"saved": True}


@router.post("/register", status_code=201, dependencies=[Depends(limit_auth)])
def register(body: Registration):
    salt = secrets.token_bytes(16)
    hashed = salt.hex() + ":" + derive(body.password, salt)
    with db(True) as c:
        if c.execute("SELECT 1 FROM account WHERE email=?", (body.email,)).fetchone():
            raise HTTPException(409, "Account unavailable")
        org = None
        if body.role == "recruiter":
            if not body.organization.strip():
                raise HTTPException(422, "Workspace name required")
            org = uid()
            c.execute(
                "INSERT INTO organization VALUES(?,?)", (org, body.organization.strip())
            )
        c.execute(
            "INSERT INTO account VALUES(?,?,?,?,?)",
            (uid(), body.email, hashed, body.role, org),
        )
    return {"created": True}


@router.post("/login", dependencies=[Depends(limit_auth)])
def login(body: Credentials, response: Response, request: Request):
    with db() as c:
        row = c.execute("SELECT * FROM account WHERE email=?", (body.email,)).fetchone()
    salt, expected = row["secret"].split(":") if row else ("00" * 16, "0" * 128)
    if (
        not hmac.compare_digest(derive(body.password, bytes.fromhex(salt)), expected)
        or not row
    ):
        raise HTTPException(401, "Invalid credentials")
    token = secrets.token_urlsafe(32)
    with db(True) as c:
        c.execute("DELETE FROM session WHERE expires<=?", (now(),))
        c.execute(
            "INSERT INTO session VALUES(?,?,?)",
            (digest(token), row["id"], now() + 28800),
        )
    response.set_cookie(
        "matrix_session",
        token,
        httponly=True,
        samesite="strict",
        secure=request.url.scheme == "https"
        or os.getenv("MATRIX_PUBLIC_ORIGIN", "").startswith("https://"),
        max_age=28800,
    )
    return {"role": row["role"], "email": row["email"]}


@router.get("/me")
def me(user=Depends(actor)):
    return user


@router.post("/logout")
def logout(response: Response, matrix_session: str | None = Cookie(default=None)):
    with db(True) as c:
        c.execute("DELETE FROM session WHERE token=?", (digest(matrix_session or ""),))
    response.delete_cookie("matrix_session")
    return {"signed_out": True}
