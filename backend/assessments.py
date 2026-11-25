import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from .access import Strict, actor, candidate_user
from .execution import run_case
from .store import db, digest, now, uid
from .utils.feedback import generate_aptitude_feedback

router = APIRouter()


class Start(Strict):
    version: str = Field(max_length=64)
    request_key: str = Field(min_length=8, max_length=100)
    invitation: str | None = None


class ResponseItem(Strict):
    question_id: str = Field(max_length=64)
    value: str = Field(min_length=1, max_length=16000)


class Submission(Strict):
    answers: list[ResponseItem] = Field(min_length=1, max_length=64)


class Draft(Strict):
    answers: list[ResponseItem] = Field(max_length=64)
    replace_snapshot: bool = False


def questions(c, version):
    return [
        (r["id"], json.loads(r["body"]))
        for r in c.execute(
            "SELECT q.id,q.body FROM assessment_question p JOIN question_version q ON q.id=p.question WHERE p.version=? ORDER BY p.position",
            (version,),
        )
    ]


def owned(c, key, user):
    row = c.execute(
        "SELECT a.*,t.kind FROM assessment_attempt a JOIN assessment_version v ON v.id=a.version JOIN assessment_template t ON t.id=v.template WHERE a.id=? AND a.owner=?",
        (key, user["id"]),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Attempt unavailable")
    return row


def state(row):
    if row["status"] == "open" and row["expires"] <= now():
        return "expired"
    return row["status"]


@router.get("/assessments")
def catalog(
    user=Depends(actor),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_only: bool = False,
):
    with db() as c:
        rows = c.execute(
            """WITH ranked AS (
                    SELECT v.id,t.company,t.level,t.kind,v.minutes,
                      row_number() OVER (PARTITION BY t.company,t.kind,t.level
                        ORDER BY v.published DESC,v.id DESC) AS position
                    FROM assessment_version v JOIN assessment_template t ON t.id=v.template
                )
                SELECT id,company,level,kind,minutes,
                  (SELECT count(*) FROM assessment_question q WHERE q.version=ranked.id) AS question_count,
                  CASE WHEN kind='coding' THEN (SELECT b.body FROM assessment_question q
                    JOIN question_version b ON b.id=q.question WHERE q.version=ranked.id AND q.position=0)
                    END AS first_body
                FROM ranked WHERE position=1 OR ?=0
                ORDER BY company,kind,level,position LIMIT ? OFFSET ?""",
            (int(current_only), limit, offset),
        )
        editions = []
        for row in rows:
            edition = dict(row)
            first = edition.pop("first_body")
            if first:
                edition["first_task"] = json.loads(first).get("title")
            editions.append(edition)
        return editions


@router.post("/attempts")
def start(body: Start, user=Depends(candidate_user)):
    with db(True) as c:
        version = c.execute(
            "SELECT * FROM assessment_version WHERE id=?", (body.version,)
        ).fetchone()
        if not version:
            raise HTTPException(404, "Assessment unavailable")
        previous = c.execute(
            "SELECT * FROM assessment_attempt WHERE owner=? AND request_key=?",
            (user["id"], body.request_key),
        ).fetchone()
        if previous:
            if (
                previous["version"] != body.version
                or previous["invitation"] != body.invitation
            ):
                raise HTTPException(409, "Request key already used")
            return {"id": previous["id"]}
        deadline = now() + version["minutes"] * 60
        if body.invitation:
            inv = c.execute(
                """SELECT i.* FROM invitation i JOIN application a ON a.id=i.application JOIN candidate p ON p.id=a.candidate
              WHERE i.id=? AND i.version=? AND p.owner=? AND i.accepted IS NOT NULL AND a.stage!='closed'""",
                (body.invitation, body.version, user["id"]),
            ).fetchone()
            if not inv:
                raise HTTPException(404, "Assignment unavailable")
            existing = c.execute(
                "SELECT id FROM assessment_attempt WHERE invitation=?", (inv["id"],)
            ).fetchone()
            if existing:
                return {"id": existing["id"]}
            deadline = min(deadline, inv["expires"])
            if deadline <= now():
                raise HTTPException(410, "Assignment expired")
        attempt = uid()
        c.execute(
            "INSERT INTO assessment_attempt VALUES(?,?,?,?,?,?,?,'open',NULL,NULL,NULL)",
            (
                attempt,
                user["id"],
                body.version,
                body.invitation,
                body.request_key,
                now(),
                deadline,
            ),
        )
    return {"id": attempt}


@router.get("/attempts")
def history(
    user=Depends(candidate_user),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    with db() as c:
        rows = c.execute(
            "SELECT a.*,t.company,t.kind,t.level FROM assessment_attempt a JOIN assessment_version v ON v.id=a.version JOIN assessment_template t ON t.id=v.template WHERE owner=? ORDER BY started DESC,a.id DESC LIMIT ? OFFSET ?",
            (user["id"], limit, offset),
        )
        return [{**dict(r), "status": state(r)} for r in rows]


@router.get("/attempts/{key}/clock")
def attempt_clock(key: str, user=Depends(candidate_user)):
    with db() as c:
        attempt = owned(c, key, user)
        return {
            "server_now": now(),
            "expires": attempt["expires"],
            "status": state(attempt),
        }


@router.get("/attempts/{key}")
def detail(key: str, user=Depends(candidate_user)):
    with db() as c:
        a = owned(c, key, user)
        items = []
        for q, b in questions(c, a["version"]):
            items.append(
                {
                    "id": q,
                    "prompt": b.get("question") or b.get("title"),
                    "description": b.get("description"),
                    "options": b.get("options"),
                    "example": (b.get("test_cases") or [None])[0],
                }
            )
        saved = {
            r["question"]: r["value"]
            for r in c.execute("SELECT * FROM answer WHERE attempt=?", (key,))
        }
        cases = [
            dict(r)
            for r in c.execute(
                """SELECT s.question,t.position,t.hidden,t.status FROM code_submission s JOIN execution_run e ON e.submission=s.id JOIN test_case_result t ON t.run=e.id WHERE s.attempt=? ORDER BY s.question,t.position""",
                (key,),
            )
        ]
        feedback = None
        if a["status"] == "complete" and a["kind"] == "aptitude":
            source = questions(c, a["version"])
            feedback = generate_aptitude_feedback(
                [saved[q] for q, _ in source], [b for _, b in source]
            )
        return {
            **dict(a),
            "status": state(a),
            "server_now": now(),
            "questions": items,
            "answers": saved,
            "case_results": cases,
            "feedback": feedback,
        }


def validate_answers(c, a, body, complete):
    qs = dict(questions(c, a["version"]))
    values = {answer.question_id: answer.value for answer in body.answers}
    if (
        len(values) != len(body.answers)
        or not values.keys() <= qs.keys()
        or (complete and values.keys() != qs.keys())
    ):
        raise HTTPException(422, "Answer the assigned questions exactly once")
    for q, v in values.items():
        if a["kind"] == "aptitude" and v not in qs[q]["options"]:
            raise HTTPException(422, "Invalid option")
        if len(v.encode()) > 16000:
            raise HTTPException(413, "Answer too large")
    return qs, values


@router.put("/attempts/{key}/draft")
def draft(key: str, body: Draft, user=Depends(candidate_user)):
    with db(True) as c:
        a = owned(c, key, user)
        if state(a) != "open":
            raise HTTPException(409, "Attempt is closed")
        _, values = validate_answers(c, a, body, False)
        if body.replace_snapshot:
            c.execute("DELETE FROM answer WHERE attempt=?", (key,))
        c.executemany(
            "INSERT INTO answer VALUES(?,?,?) ON CONFLICT(attempt,question) DO UPDATE SET value=excluded.value",
            [(key, q, v) for q, v in values.items()],
        )
    return {"saved": True}


@router.post("/attempts/{key}/submit")
def submit(key: str, body: Submission, user=Depends(candidate_user)):
    with db(True) as c:
        a = owned(c, key, user)
        qs, values = validate_answers(c, a, body, True)
        status = state(a)
        if status == "expired":
            raise HTTPException(410, "Attempt expired")
        if status != "open":
            saved = {
                r["question"]: r["value"]
                for r in c.execute(
                    "SELECT question,value FROM answer WHERE attempt=?", (key,)
                )
            }
            if saved != values:
                raise HTTPException(409, "Submitted answers are immutable")
            if status == "complete":
                return {"status": status, "score": a["score"], "total": a["total"]}
            if c.execute(
                "SELECT 1 FROM grading_lease WHERE attempt=? AND expires>?",
                (key, now()),
            ).fetchone():
                raise HTTPException(409, "Grading in progress")
        c.executemany(
            "INSERT INTO answer VALUES(?,?,?) ON CONFLICT(attempt,question) DO UPDATE SET value=excluded.value",
            [(key, q, v) for q, v in values.items()],
        )
        if a["kind"] == "aptitude":
            score = sum(v == qs[q]["answer"] for q, v in values.items())
            c.execute(
                "UPDATE assessment_attempt SET submitted=?,score=?,total=?,status='complete' WHERE id=?",
                (now(), score, len(qs), key),
            )
            return {"status": "complete", "score": score, "total": len(qs)}
        lease = uid()
        c.execute(
            "INSERT INTO grading_lease VALUES(?,?,?) ON CONFLICT(attempt) DO UPDATE SET nonce=excluded.nonce,expires=excluded.expires",
            (key, lease, now() + 600),
        )
        c.execute(
            "UPDATE assessment_attempt SET status='grading',submitted=COALESCE(submitted,?) WHERE id=?",
            (now(), key),
        )
    records = []
    try:
        for q, b in qs.items():
            results = []
            for index, case in enumerate(b["test_cases"]):
                result = run_case(values[q], case["input"])
                output = result["stdout"].replace("\r\n", "\n").rstrip("\n")
                verdict = result["status"]
                if verdict == "finished":
                    verdict = (
                        "passed"
                        if output == case["output"].replace("\r\n", "\n").rstrip("\n")
                        else "wrong_answer"
                    )
                results.append(
                    (index, int(index > 0), verdict, digest(output), result["engine"])
                )
            records.append((q, results))
    except Exception:
        with db(True) as c:
            if c.execute(
                "DELETE FROM grading_lease WHERE attempt=? AND nonce=?", (key, lease)
            ).rowcount:
                c.execute(
                    "UPDATE assessment_attempt SET status='runner_unavailable' WHERE id=?",
                    (key,),
                )
        raise HTTPException(
            503, "Runner unavailable. Your submitted answers are saved for retry."
        )
    score = total = 0
    with db(True) as c:
        if not c.execute(
            "DELETE FROM grading_lease WHERE attempt=? AND nonce=?", (key, lease)
        ).rowcount:
            raise HTTPException(409, "Another request recovered this attempt")
        for q, results in records:
            engine = ",".join(sorted({case[4] for case in results}))
            sub, run = uid(), uid()
            c.execute(
                "INSERT INTO code_submission VALUES(?,?,?,?)", (sub, key, q, values[q])
            )
            c.execute(
                "INSERT INTO execution_run VALUES(?,?,?,?)", (run, sub, engine, now())
            )
            c.executemany(
                "INSERT INTO test_case_result(run,position,hidden,status,output_hash,engine) VALUES(?,?,?,?,?,?)",
                [(run, *r) for r in results],
            )
            total += len(results)
            score += sum(r[2] == "passed" for r in results)
        c.execute(
            "UPDATE assessment_attempt SET score=?,total=?,status='complete' WHERE id=?",
            (score, total, key),
        )
    return {"status": "complete", "score": score, "total": total}
