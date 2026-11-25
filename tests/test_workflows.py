import io
import json
import sqlite3
from unittest.mock import patch

import pymupdf
import pytest
import psycopg
from docx import Document
from moto import mock_aws

from backend import documents
from backend.execution import run_case
from backend.extraction import extract
from backend.store import db, now


P = "/api/v1"


def post(client, path, data, status=200):
    r = client.post(P + path, json=data)
    assert r.status_code == status, r.text
    return r.json()


def catalog(client, kind):
    return next(
        v
        for v in client.get(P + "/assessments").json()
        if v["kind"] == kind and v["level"] == "beginner" and v["company"] == "wipro"
    )


def assessment(client, kind):
    v = catalog(client, kind)
    key = post(
        client, "/attempts", {"version": v["id"], "request_key": "request-" + kind}
    )["id"]
    return "/attempts/" + key, client.get(P + "/attempts/" + key).json()


def test_practice_catalog_picks_latest_version_per_level(site):
    client = site("practice", "candidate")
    original = catalog(client, "coding")
    with db(True) as conn:
        # Create another published edition of exactly the same template.
        conn.execute(
            "INSERT INTO assessment_version SELECT ?,template,45,published+1 FROM assessment_version WHERE id=?",
            ("new-practice-edition", original["id"]),
        )
    current = client.get(P + "/assessments?current_only=true&limit=100").json()
    company = [v for v in current if v["company"] == "wipro"]
    assert len(company) == 6
    assert {v["kind"] for v in company} == {"aptitude", "coding"}
    selected = next(
        v for v in company if v["kind"] == "coding" and v["level"] == "beginner"
    )
    assert selected["id"] == "new-practice-edition" and selected["minutes"] == 45
    assert original["question_count"] > 0
    all_versions = client.get(P + "/assessments?limit=100").json()
    assert original["id"] in {v["id"] for v in all_versions}
    assert (
        client.get(P + "/assessments?current_only=true&limit=1&offset=1").json()
        == current[1:2]
    )


def test_integrity_and_recovery(site):
    c = site("one", "candidate")
    other = site("two", "candidate")
    path, a = assessment(c, "aptitude")
    assert assessment(c, "aptitude")[0] == path
    assert other.get(P + path).status_code == 404
    assert "answer" not in a["questions"][0]
    answers = [
        {"question_id": q["id"], "value": q["options"][0]} for q in a["questions"]
    ]
    with db() as conn:
        expected = sum(
            json.loads(
                conn.execute(
                    "SELECT body FROM question_version WHERE id=?", (x["question_id"],)
                ).fetchone()[0]
            )["answer"]
            == x["value"]
            for x in answers
        )
    for bad in ({"questions": []}, {"score": 15}, {"answer_key": []}):
        post(c, path + "/submit", {"answers": answers, **bad}, 422)
    post(
        c,
        path + "/submit",
        {"answers": [{"question_id": "invalid", "value": "x"}]},
        422,
    )
    post(
        c,
        path + "/submit",
        {"answers": [{**answers[0], "value": "invented"}, *answers[1:]]},
        422,
    )
    post(c, path + "/submit", {"answers": [{"question_id": -1, "value": "Green"}]}, 422)
    post(other, path + "/submit", {"answers": answers}, 404)
    assert c.put(P + path + "/draft", json={"answers": answers[:1]}).status_code == 200
    assert (
        c.get(P + path).json()["answers"][answers[0]["question_id"]]
        == answers[0]["value"]
    )
    first = post(c, path + "/submit", {"answers": answers})
    assert (
        first == post(c, path + "/submit", {"answers": answers})
        and first["score"] == expected
    )
    answers[0]["value"] = a["questions"][0]["options"][1]
    post(c, path + "/submit", {"answers": answers}, 409)
    for statement in (
        "UPDATE question_version SET body='{}'",
        "DELETE FROM assessment_question",
    ):
        with (
            pytest.raises((sqlite3.IntegrityError, psycopg.errors.RaiseException)),
            db(True) as conn,
        ):
            conn.execute(statement)


def test_expired(site):
    c = site("candidate", "candidate")
    path, a = assessment(c, "aptitude")
    with db(True) as conn:
        conn.execute("UPDATE assessment_attempt SET expires=0")
    assert c.get(P + path).json()["status"] == "expired"
    post(
        c,
        path + "/submit",
        {
            "answers": [
                {"question_id": q["id"], "value": q["options"][0]}
                for q in a["questions"]
            ]
        },
        410,
    )


def test_real_coding(site):
    c = site("coder", "candidate")
    path, a = assessment(c, "coding")
    solutions = [
        "n=int(input())\nfor i in range(1,n+1):print('*'*i)",
        "print(sum(map(int,input().split())))",
        "print('wrong')",
    ]
    result = post(
        c,
        path + "/submit",
        {
            "answers": [
                {"question_id": q["id"], "value": src}
                for q, src in zip(a["questions"], solutions)
            ]
        },
    )
    assert result["score"] == 4 and result["total"] == 6
    detail = c.get(P + path).json()
    assert (
        len(detail["case_results"]) == 6
        and sum(t["hidden"] for t in detail["case_results"]) == 3
    )
    with db() as conn:
        assert conn.execute("SELECT count(*) FROM execution_run").fetchone()[0] == 3


@pytest.mark.parametrize(
    "source,status",
    [
        ("x =", "compilation_error"),
        ("while True: pass", "time_limit"),
        ("x=bytearray(200_000_000)", "memory_limit"),
        ("raise ValueError('example')", "runtime_error"),
    ],
)
def test_runner_limits(source, status):
    assert run_case(source, "")["status"] == status


def test_runner_output_is_bounded():
    result = run_case("print('x'*40000)", "")
    assert (
        result["status"] == "output_limit" and len(result["stdout"].encode()) <= 16384
    )


def test_guest_capabilities():
    result = run_case(
        "import os\nprint(os.environ.get('MATRIX_DB'))\ntry:\n open('/host.txt','w')\nexcept OSError: print('no-file')\ntry:\n import socket\n socket.socket()\nexcept (ImportError,OSError,AttributeError): print('no-network')",
        "",
    )
    assert result["status"] == "finished" and result["stdout"].splitlines() == [
        "None",
        "no-file",
        "no-network",
    ]


def pipeline(site):
    r = site("staff", "recruiter")
    outsider = site("outside", "recruiter")
    c = site("person", "candidate")
    body = {
        "title": "Python engineer",
        "description": "Build services",
        "criteria": [{"name": "Python", "weight": 100}],
        "status": "published",
    }
    job = post(r, "/jobs", body)
    post(c, "/jobs", body, 403)
    post(outsider, "/jobs/" + job["id"] + "/versions", body, 404)
    person = post(
        r, "/candidates", {"name": "Sample candidate", "email": "person@example.org"}
    )
    a = post(
        r, "/applications", {"candidate": person["id"], "job_version": job["version"]}
    )["id"]
    path = "/applications/" + a
    assert (
        c.get(P + path).status_code == 404 and outsider.get(P + path).status_code == 404
    )
    version = catalog(c, "aptitude")["id"]
    invite = post(
        r, path + "/invitations", {"version": version, "expires": now() + 3600}
    )
    with db() as conn:
        assert (
            conn.execute("SELECT token FROM invitation").fetchone()[0]
            != invite["token"]
        )
    post(c, "/invitations/accept", {"token": invite["token"]})
    post(
        c,
        "/attempts",
        {"version": version, "invitation": invite["id"], "request_key": "assigned-1"},
    )
    return r, outsider, c, path, invite


def test_pipeline(site):
    r, o, c, path, i = pipeline(site)
    assert r.get(P + path).json()["invitations"][0]["status"] == "open"
    post(r, path + "/stage", {"stage": "applied"}, 409)
    post(c, path + "/stage", {"stage": "review"}, 403)
    post(r, path + "/stage", {"stage": "review"})
    assert c.get(P + path).json()["history"][-1]["stage"] == "review"
    with db(True) as conn:
        conn.execute("UPDATE invitation SET expires=0")
    post(c, "/invitations/accept", {"token": i["token"]}, 410)


def make_docx():
    d = Document()
    for line in ["Skills", "Python", "Education", "Example program, 2022"]:
        d.add_paragraph(line)
    s = io.BytesIO()
    d.save(s)
    return s.getvalue()


def make_pdf(text):
    with pymupdf.open() as d:
        p = d.new_page()
        if text:
            p.insert_text((50, 60), text)
        return d.tobytes()


def test_extract_native_and_ocr():
    facts, w = extract(make_docx(), "docx", "doc")
    assert (
        facts["skills"][0]["evidence"]["excerpt"] == "Python"
        and facts["dates"][0]["status"] == "ambiguous"
        and w
    )
    facts, w = extract(
        make_pdf("Skills\nPython for relational data pipelines"), "pdf", "doc"
    )
    assert facts["skills"][0]["evidence"]["page"] == 1
    with patch("backend.extraction.ocr", return_value="Skills\nPython"):
        assert (
            extract(make_pdf(""), "pdf", "doc")[0]["skills"][0]["evidence"]["method"]
            == "ocr"
        )
    with patch("backend.extraction.ocr", side_effect=ValueError):
        with pytest.raises(ValueError):
            extract(make_pdf(""), "pdf", "doc")
    with pytest.raises(Exception):
        extract(b"broken", "docx", "doc")


@mock_aws
def test_upload_pipeline(site, monkeypatch):
    r, o, c, path, i = pipeline(site)
    docs = P + path + "/resumes"
    monkeypatch.setenv("S3_ENDPOINT", "https://s3.amazonaws.com")  # intercepted by Moto
    documents.storage().create_bucket(Bucket=documents.BUCKET)
    monkeypatch.setattr(
        documents.process, "delay", lambda k, g: documents.process.run(k, g)
    )
    monkeypatch.setattr(documents, "scan", lambda b: None)
    headers = {
        "content-type": "application/pdf",
        "x-file-extension": "pdf",
        "x-resume-consent": "review-v1",
    }
    blob = make_pdf("Skills\nPython for relational data pipelines")
    assert o.post(docs, content=blob, headers=headers).status_code == 404
    assert c.post(docs, content=b"bad", headers=headers).status_code == 422
    assert (
        c.post(
            docs, content=blob, headers={**headers, "content-type": "text/plain"}
        ).status_code
        == 415
    )
    assert (
        c.post(docs, content=b"x" * (documents.LIMIT + 1), headers=headers).status_code
        == 413
    )
    assert r.post(docs, content=blob, headers=headers).status_code == 403
    post(c, path + "/resume-consent", {})
    with patch("backend.documents.storage", side_effect=OSError):
        assert c.post(docs, content=blob, headers=headers).status_code == 503
    assert c.get(docs).json()[0]["status"] == "upload_failed"
    key = r.post(docs, content=blob, headers=headers).json()["id"]
    assert c.post(docs, content=blob, headers=headers).json()["id"] == key
    target = P + "/resumes/" + key
    assert c.get(target).json()["facts"]["skills"] and o.get(target).status_code == 404
    assert r.get(target + "/original").content == blob
    post(
        r,
        "/resumes/" + key + "/corrections",
        {"field": "skills", "value": "Python", "reason": "Reviewed excerpt"},
    )
    assert c.get(target).json()["corrections"]
    monkeypatch.setattr(
        documents, "scan", lambda _: (_ for _ in ()).throw(ValueError())
    )
    post(c, "/resumes/" + key + "/retry", {})
    assert c.get(target).json()["status"] == "failed"
    assert c.delete(target).status_code == 200 and r.get(target).status_code == 404


def test_private_profile_and_assignments(site):
    r, other, c, path, invite = pipeline(site)
    assert (
        c.put(
            P + "/profile",
            json={"name": "Demo User", "headline": "Systems engineering"},
        ).status_code
        == 200
    )
    assert c.get(P + "/profile").json()["headline"] == "Systems engineering"
    assert r.get(P + "/profile").status_code == 403
    unrelated = site("unrelated", "candidate")
    assert unrelated.get(P + "/profile").json()["name"] == ""
    assert unrelated.get(P + "/invitations").json() == []
    assert c.get(P + "/invitations").json()[0]["id"] == invite["id"]
    version = r.get(P + "/jobs").json()[0]["id"]
    vpath = "/job-versions/" + version + "/assessments"
    post(r, vpath, {"assessment": catalog(c, "aptitude")["id"]})
    assert len(r.get(P + vpath).json()) == 1
    post(other, vpath, {"assessment": catalog(c, "aptitude")["id"]}, 404)
    assert c.get(P + vpath).status_code == 403


def test_real_scan_ocr():
    import shutil

    if not shutil.which("tesseract"):
        pytest.skip("English Tesseract required")
    with pymupdf.open() as source:
        p = source.new_page(width=450, height=250)
        p.insert_text((30, 60), "Skills\nPython", fontsize=28)
        img = p.get_pixmap(matrix=pymupdf.Matrix(2, 2)).tobytes("png")
    with pymupdf.open() as scanned:
        page = scanned.new_page(width=450, height=250)
        page.insert_image(page.rect, stream=img)
        assert not page.get_text().strip()
        facts, _ = extract(scanned.tobytes(), "pdf", "scan")
    assert any(
        f["value"] == "Python" and f["evidence"]["method"] == "ocr"
        for f in facts["skills"]
    )


def test_recover_grader_and_origin(site, monkeypatch):
    c = site("recover", "candidate")
    path, a = assessment(c, "coding")
    data = {
        "answers": [
            {"question_id": q["id"], "value": "print(0)"} for q in a["questions"]
        ]
    }
    monkeypatch.setattr(
        "backend.assessments.run_case", lambda *_: (_ for _ in ()).throw(RuntimeError())
    )
    post(c, path + "/submit", data, 503)
    assert c.get(P + path).json()["status"] == "runner_unavailable"
    monkeypatch.setattr(
        "backend.assessments.run_case",
        lambda *_: {"status": "finished", "engine": "test-adapter", "stdout": "0"},
    )
    retry = post(c, path + "/submit", data)
    assert retry["status"] == "complete" and post(c, path + "/submit", data) == retry
    assert (
        c.post(
            P + "/logout", headers={"Origin": "https://other.example.org"}
        ).status_code
        == 403
    )
    assert (
        c.post(P + "/logout", headers={"Origin": "http://localhost"}).status_code == 200
    )
