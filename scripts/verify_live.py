"""Rehearse the running local stack using fresh synthetic accounts and the real worker and scanner."""

from contextlib import closing
import io
import secrets
import time
from docx import Document
import httpx

BASE = "http://127.0.0.1:5173/api/v1/"


def call(client, method, path, **kwargs):
    r = client.request(method, path, **kwargs)
    if not r.is_success:
        raise RuntimeError(
            f"{method} returned {r.status_code}; request {r.headers.get('X-Request-ID', 'unknown')}"
        )
    return r.json()


def account(role):
    c = httpx.Client(
        base_url=BASE, headers={"Origin": "http://127.0.0.1:5173"}, timeout=90
    )
    email = role + "-" + secrets.token_hex(8) + "@example.org"
    auth = {"email": email, "password": secrets.token_urlsafe(24)}
    call(
        c,
        "POST",
        "register",
        json={**auth, "role": role, "organization": "Synthetic demonstration"},
    )
    call(c, "POST", "login", json=auth)
    return c, email


def run():
    recruiter, _ = account("recruiter")
    candidate, email = account("candidate")
    with closing(recruiter), closing(candidate):
        job = call(
            recruiter,
            "POST",
            "jobs",
            json={
                "title": "Python engineer",
                "description": "Build Python services",
                "status": "published",
                "criteria": [
                    {"name": "Python", "weight": 40, "scale": 5},
                    {
                        "name": "Aptitude",
                        "evaluation_type": "aptitude",
                        "weight": 60,
                        "scale": 10,
                    },
                ],
            },
        )
        person = call(
            recruiter,
            "POST",
            "candidates",
            json={"name": "Synthetic candidate", "email": email},
        )
        application = call(
            recruiter,
            "POST",
            "applications",
            json={"candidate": person["id"], "job_version": job["version"]},
        )["id"]
        path = "applications/" + application
        version = next(
            v["id"]
            for v in call(recruiter, "GET", "assessments")
            if v["kind"] == "aptitude"
        )
        invite = call(
            recruiter,
            "POST",
            path + "/invitations",
            json={"version": version, "expires": int(time.time()) + 3600},
        )
        call(candidate, "POST", "invitations/accept", json={"token": invite["token"]})
        call(candidate, "POST", path + "/resume-consent", json={})
        d = Document()
        d.add_paragraph("Skills")
        d.add_paragraph("Python")
        s = io.BytesIO()
        d.save(s)
        document = call(
            recruiter,
            "POST",
            path + "/resumes",
            content=s.getvalue(),
            headers={
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "X-File-Extension": "docx",
                "X-Resume-Consent": "review-v1",
            },
        )
        locator = "resumes/" + document["id"]
        try:
            for _ in range(90):
                state = call(recruiter, "GET", locator)["status"]
                if state in ("ready", "needs_review", "failed"):
                    break
                time.sleep(1)
            assert state in ("ready", "needs_review")
            a = call(
                candidate,
                "POST",
                "attempts",
                json={
                    "version": version,
                    "request_key": secrets.token_hex(12),
                    "invitation": invite["id"],
                },
            )["id"]
            questions = call(candidate, "GET", "attempts/" + a)["questions"]
            call(
                candidate,
                "POST",
                "attempts/" + a + "/submit",
                json={
                    "answers": [
                        {"question_id": q["id"], "value": q["options"][0]}
                        for q in questions
                    ]
                },
            )
            e = call(
                recruiter,
                "POST",
                path + "/evaluations",
                json={"provider": "local", "scope": "combined"},
            )["id"]
            card = call(recruiter, "GET", "evaluations/" + e)
            assert (
                card["version"] == job["version"]
                and card["criteria"][0]["source"]["document"] == document["id"]
            )
            review = "evaluations/" + e + "/review"
            for i, f in enumerate(card["criteria"]):
                call(
                    recruiter,
                    "POST",
                    review,
                    json={
                        "action": "accept",
                        "criterion": f["criterion_id"],
                        "reason": "Verified synthetic source for rehearsal",
                        "revision": i,
                    },
                )
            call(
                recruiter,
                "POST",
                review,
                json={
                    "action": "review_complete",
                    "reason": "Synthetic evidence review complete",
                    "revision": 2,
                },
            )
            final = call(recruiter, "GET", "evaluations/" + e)
            assert (
                final["reviewed_aggregate"]["score_percent"] is not None
                and final["history"][-1]["action"] == "review_complete"
            )
            assert call(recruiter, "GET", path)["stage"] == "assessment"
            print(
                "PASS: private upload, extraction, assessment, scorecard, citations and human review."
            )
        finally:
            call(candidate, "DELETE", locator)


if __name__ == "__main__":
    run()
