"""Tenant-scoped recruitment commands. Candidate records are claimed by invitation."""

import json
import re
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, field_validator, model_validator

from .access import Strict, actor, candidate_user, normalize_email, recruiter
from .store import db, digest, now, uid

router = APIRouter()


@router.get("/overview")
def overview(user=Depends(actor)):
    with db() as c:
        if user["role"] == "recruiter":
            org = user["org"]
            return {
                "name": c.execute(
                    "SELECT name FROM organization WHERE id=?", (org,)
                ).fetchone()[0],
                "stages": {
                    row["stage"]: row["amount"]
                    for row in c.execute(
                        """SELECT a.stage, count(*) AS amount FROM application a
                        JOIN candidate p ON p.id=a.candidate WHERE p.org=? GROUP BY a.stage""",
                        (org,),
                    )
                },
                "metrics": {
                    "Jobs": c.execute(
                        "SELECT count(*) FROM job WHERE org=?", (org,)
                    ).fetchone()[0],
                    "Candidates": c.execute(
                        "SELECT count(*) FROM candidate WHERE org=?", (org,)
                    ).fetchone()[0],
                    "Completed assessments": c.execute(
                        "SELECT count(*) FROM assessment_attempt t JOIN invitation i ON i.id=t.invitation JOIN application a ON a.id=i.application JOIN candidate p ON p.id=a.candidate WHERE p.org=? AND t.status='complete'",
                        (org,),
                    ).fetchone()[0],
                },
            }
        stats = c.execute(
            "SELECT count(*) attempts,count(score) completed,round(avg(100.0*score/nullif(total,0))) average FROM assessment_attempt WHERE owner=?",
            (user["id"],),
        ).fetchone()
        today = now() // 86400
        first_day = today - 13
        activity = {
            row["day"]: row["amount"]
            for row in c.execute(
                """SELECT submitted/86400 AS day, count(*) AS amount FROM assessment_attempt
                WHERE owner=? AND status='complete' AND submitted>=? AND submitted<?
                GROUP BY submitted/86400""",
                (user["id"], first_day * 86400, (today + 1) * 86400),
            )
        }
        last = c.execute(
            """SELECT a.id,t.kind,t.level,a.score,a.total FROM assessment_attempt a
            JOIN assessment_version v ON v.id=a.version JOIN assessment_template t ON t.id=v.template
            WHERE a.owner=? AND a.status='complete' ORDER BY a.submitted DESC,a.id DESC LIMIT 1""",
            (user["id"],),
        ).fetchone()
        return {
            "name": "Candidate workspace",
            "activity": [
                {"day": day * 86400, "count": activity.get(day, 0)}
                for day in range(first_day, today + 1)
            ],
            "last_result": dict(last) if last else None,
            "metrics": {
                "Attempts": stats["attempts"],
                "Completed": stats["completed"],
                "Mean score": str(int(stats["average"])) + "%"
                if stats["average"] is not None
                else "—",
            },
        }


class Criterion(Strict):
    name: str = Field(min_length=1, max_length=120)
    weight: int = Field(ge=1, le=100)
    description: str = Field(
        default="Review documented job-related evidence.", max_length=400
    )
    evaluation_type: Literal[
        "skills",
        "employment",
        "projects",
        "education",
        "aptitude",
        "coding",
        "code_review",
    ] = "skills"
    required_evidence: str = Field(default="", max_length=100)
    scale: int = Field(default=100, ge=1, le=100)
    instructions: Literal["explicit evidence only", "require human confirmation"] = (
        "explicit evidence only"
    )

    @model_validator(mode="after")
    def job_related(self):
        text = " ".join((self.name, self.required_evidence, self.description))
        protected = r"\b(?:race|racial|religion|religious|age|gender|ethnicity|pregnan\w*|disabilit\w*|national origin|sexual orientation|health status|personality)\b"
        if re.search(protected, text, re.I):
            raise ValueError("Choose a job-related evidence requirement")
        return self


class Job(Strict):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=8000)
    criteria: list[Criterion] = Field(min_length=1, max_length=20)
    status: Literal["draft", "published"]

    @model_validator(mode="after")
    def weights(self):
        if sum(i.weight for i in self.criteria) != 100 or len(
            {i.name.casefold() for i in self.criteria}
        ) != len(self.criteria):
            raise ValueError("Distinct criteria must total 100 percent")
        return self


class Person(Strict):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=254)
    _email = field_validator("email")(normalize_email)


class Apply(Strict):
    candidate: str
    job_version: str


class Invite(Strict):
    version: str
    expires: int


class Claim(Strict):
    token: str = Field(min_length=20, max_length=128)


class Stage(Strict):
    stage: Literal["applied", "assessment", "review", "closed"]


def require(row):
    if row is None:
        raise HTTPException(404, "Resource unavailable")
    return row


def application(c, key, u):
    sql = """SELECT a.*,p.org,p.owner,p.name,j.title FROM application a JOIN candidate p ON a.candidate=p.id JOIN job_version j ON j.id=a.job_version WHERE a.id=? AND """
    return require(
        c.execute(
            sql + ("p.org=?" if u["role"] == "recruiter" else "p.owner=?"),
            (key, u["org"] if u["role"] == "recruiter" else u["id"]),
        ).fetchone()
    )


def event(c, key, stage):
    c.execute(
        "INSERT INTO application_event(application,stage,at) VALUES(?,?,?)",
        (key, stage, now()),
    )


@router.post("/jobs")
def create_job(body: Job, user=Depends(recruiter)):
    return save_job(body, user, None)


@router.post("/jobs/{key}/versions")
def revise(key: str, body: Job, user=Depends(recruiter)):
    return save_job(body, user, key)


def save_job(body, user, key):
    with db(True) as c:
        if key:
            require(
                c.execute(
                    "SELECT id FROM job WHERE id=? AND org=?", (key, user["org"])
                ).fetchone()
            )
        else:
            key = uid()
            c.execute("INSERT INTO job VALUES(?,?)", (key, user["org"]))
        revision = c.execute(
            "SELECT count(*)+1 FROM job_version WHERE job=?", (key,)
        ).fetchone()[0]
        vid = uid()
        c.execute(
            "INSERT INTO job_version VALUES(?,?,?,?,?,?,?)",
            (
                vid,
                key,
                revision,
                body.title,
                body.description,
                json.dumps([x.model_dump() for x in body.criteria]),
                body.status,
            ),
        )
    return {"id": key, "version": vid}


@router.get("/jobs")
def jobs(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(recruiter),
):
    with db() as c:
        return [
            {**dict(r), "criteria": json.loads(r["criteria"])}
            for r in c.execute(
                "SELECT v.* FROM job_version v JOIN job j ON j.id=v.job WHERE j.org=? ORDER BY v.revision DESC,v.id DESC LIMIT ? OFFSET ?",
                (user["org"], limit, offset),
            )
        ]


@router.post("/candidates")
def create_candidate(body: Person, user=Depends(recruiter)):
    with db(True) as c:
        c.execute(
            "INSERT INTO candidate VALUES(?,?,?,?,NULL) ON CONFLICT DO NOTHING",
            (uid(), user["org"], body.email, body.name),
        )
        return dict(
            c.execute(
                "SELECT id FROM candidate WHERE email=? AND org=?",
                (body.email, user["org"]),
            ).fetchone()
        )


@router.get("/candidates")
def people(
    search: str = Query("", max_length=120),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(recruiter),
):
    with db() as c:
        return [
            dict(r)
            for r in c.execute(
                "SELECT id,name,email FROM candidate WHERE org=? AND (instr(lower(name),lower(?))>0 OR instr(email,lower(?))>0) ORDER BY name,id LIMIT ? OFFSET ?",
                (user["org"], search, search, limit, offset),
            )
        ]


@router.post("/applications")
def apply(body: Apply, user=Depends(recruiter)):
    with db(True) as c:
        require(
            c.execute(
                "SELECT id FROM candidate WHERE org=? AND id=?",
                (user["org"], body.candidate),
            ).fetchone()
        )
        require(
            c.execute(
                "SELECT v.id FROM job_version v JOIN job j ON j.id=v.job WHERE v.id=? AND j.org=? AND v.status='published'",
                (body.job_version, user["org"]),
            ).fetchone()
        )
        key = uid()
        if c.execute(
            "INSERT INTO application VALUES(?,?,?,'applied') ON CONFLICT DO NOTHING",
            (key, body.job_version, body.candidate),
        ).rowcount:
            event(c, key, "applied")
        return dict(
            c.execute(
                "SELECT id FROM application WHERE candidate=? AND job_version=?",
                (body.candidate, body.job_version),
            ).fetchone()
        )


@router.get("/applications")
def pipeline(
    stage: str = "",
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(actor),
):
    query = """SELECT a.id,a.stage,v.title,p.name,p.email FROM application a JOIN candidate p ON p.id=a.candidate JOIN job_version v ON v.id=a.job_version WHERE (a.stage=? OR ?='') AND """
    with db() as c:
        return [
            dict(r)
            for r in c.execute(
                query
                + ("p.org=?" if user["role"] == "recruiter" else "p.owner=?")
                + " ORDER BY a.id DESC LIMIT ? OFFSET ?",
                (stage, stage, user["org"] or user["id"], limit, offset),
            )
        ]


@router.get("/applications/{key}")
def details(key: str, user=Depends(actor)):
    with db() as c:
        a = application(c, key, user)
        return {
            "id": key,
            "title": a["title"],
            "name": a["name"],
            "stage": a["stage"],
            "history": [
                dict(r)
                for r in c.execute(
                    "SELECT stage,at FROM application_event WHERE application=? ORDER BY id",
                    (key,),
                )
            ],
            "invitations": [
                {
                    **dict(r),
                    "status": (
                        "complete"
                        if r["attempt_status"] == "complete"
                        else "expired"
                        if min(r["expires"], r["attempt_expires"] or r["expires"])
                        <= now()
                        else r["attempt_status"]
                        or ("accepted" if r["accepted"] else "invited")
                    ),
                }
                for r in c.execute(
                    "SELECT i.id,i.version,i.expires,i.accepted,t.id attempt,t.status attempt_status,t.expires attempt_expires,t.score,t.total FROM invitation i LEFT JOIN assessment_attempt t ON t.invitation=i.id WHERE i.application=? ORDER BY i.id DESC",
                    (key,),
                )
            ],
        }


@router.post("/applications/{key}/stage")
def transition(key: str, body: Stage, user=Depends(recruiter)):
    with db(True) as c:
        a = application(c, key, user)
        allowed = {
            "applied": {"assessment", "closed"},
            "assessment": {"review", "closed"},
            "review": {"closed"},
            "closed": set(),
        }
        if body.stage not in allowed[a["stage"]]:
            raise HTTPException(409, "Invalid stage transition")
        c.execute("UPDATE application SET stage=? WHERE id=?", (body.stage, key))
        event(c, key, body.stage)
    return {"stage": body.stage}


@router.get("/job-versions/{version}/assessments")
def assigned_versions(
    version: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(recruiter),
):
    with db() as c:
        require(
            c.execute(
                "SELECT 1 FROM job_version v JOIN job j ON j.id=v.job WHERE v.id=? AND j.org=?",
                (version, user["org"]),
            ).fetchone()
        )
        return [
            dict(r)
            for r in c.execute(
                """SELECT x.assessment AS id,t.company,t.kind,t.level FROM job_assessment x
          JOIN assessment_version v ON v.id=x.assessment JOIN assessment_template t ON t.id=v.template
          WHERE x.job_version=? ORDER BY t.company,t.kind,t.level LIMIT ? OFFSET ?""",
                (version, limit, offset),
            )
        ]


class Assignment(Strict):
    assessment: str = Field(max_length=64)


@router.post("/job-versions/{version}/assessments")
def assign_version(version: str, body: Assignment, user=Depends(recruiter)):
    with db(True) as c:
        require(
            c.execute(
                "SELECT 1 FROM job_version v JOIN job j ON j.id=v.job WHERE v.id=? AND j.org=? AND v.status='published'",
                (version, user["org"]),
            ).fetchone()
        )
        require(
            c.execute(
                "SELECT 1 FROM assessment_version WHERE id=?", (body.assessment,)
            ).fetchone()
        )
        c.execute(
            "INSERT INTO job_assessment VALUES(?,?) ON CONFLICT DO NOTHING",
            (version, body.assessment),
        )
    return {"assigned": True}


@router.get("/invitations")
def my_invitations(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(candidate_user),
):
    with db() as c:
        return [
            dict(r)
            for r in c.execute(
                """SELECT i.id,i.version,i.accepted,i.expires,j.title,o.name organization,
          t.id attempt, CASE WHEN t.status='complete' THEN 'complete' WHEN (CASE WHEN t.expires<i.expires THEN t.expires ELSE i.expires END)<=? THEN 'expired'
          WHEN t.status IS NOT NULL THEN t.status WHEN i.accepted IS NOT NULL THEN 'accepted' ELSE 'invited' END status
          FROM invitation i JOIN application a ON a.id=i.application JOIN candidate p ON p.id=a.candidate JOIN organization o ON o.id=p.org
          JOIN job_version j ON j.id=a.job_version LEFT JOIN assessment_attempt t ON t.invitation=i.id
          WHERE p.owner=? ORDER BY i.id DESC LIMIT ? OFFSET ?""",
                (now(), user["id"], limit, offset),
            )
        ]


@router.post("/applications/{key}/invitations")
def invite(key: str, body: Invite, user=Depends(recruiter)):
    with db(True) as c:
        a = application(c, key, user)
        if a["stage"] not in ("applied", "assessment"):
            raise HTTPException(409, "Application is past assessment")
        require(
            c.execute(
                "SELECT id FROM assessment_version WHERE id=?", (body.version,)
            ).fetchone()
        )
        if not now() < body.expires <= now() + 90 * 86400:
            raise HTTPException(422, "Choose an expiry within 90 days")
        c.execute(
            "INSERT INTO job_assessment VALUES(?,?) ON CONFLICT DO NOTHING",
            (a["job_version"], body.version),
        )
        token = secrets.token_urlsafe(32)
        iid = uid()
        c.execute(
            "INSERT INTO invitation VALUES(?,?,?,?,?,NULL)",
            (iid, key, body.version, digest(token), body.expires),
        )
        if a["stage"] == "applied":
            c.execute("UPDATE application SET stage='assessment' WHERE id=?", (key,))
            event(c, key, "assessment")
    return {"id": iid, "token": token}


@router.post("/invitations/accept")
def accept(body: Claim, user=Depends(candidate_user)):
    with db(True) as c:
        row = require(
            c.execute(
                """SELECT i.*,p.id person,p.owner FROM invitation i JOIN application a ON a.id=i.application
          JOIN candidate p ON p.id=a.candidate WHERE i.token=? AND p.email=? AND a.stage!='closed'""",
                (digest(body.token), user["email"]),
            ).fetchone()
        )
        if row["expires"] <= now():
            raise HTTPException(410, "Invitation expired")
        if row["owner"] and row["owner"] != user["id"]:
            raise HTTPException(403, "Invitation unavailable")
        c.execute(
            "UPDATE candidate SET owner=? WHERE id=?", (user["id"], row["person"])
        )
        c.execute(
            "UPDATE invitation SET accepted=COALESCE(accepted,?) WHERE id=?",
            (now(), row["id"]),
        )
        return {
            "application": row["application"],
            "id": row["id"],
            "version": row["version"],
        }
