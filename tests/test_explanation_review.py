from backend import followups
from backend.store import db, now
from test_followups import discussion
from test_workflows import P, catalog, pipeline, post

SOURCE = "for item in items:\n    print(item)"
REPLY = "I visit each item because I need to output every value. For example, an empty input produces no lines."


def save(client, path, qid, route):
    assert client.put(
        path + "/draft", json={"answers": [{"question_id": qid, "value": SOURCE}]}
    ).is_success
    assert client.post(route, json={"turn": 1}).is_success
    response = client.put(route + "/1", json={"text": REPLY})
    assert response.is_success
    return response.json()


def test_reviews_are_grounded_private_recoverable_and_optional(site, monkeypatch):
    user = site("author", "candidate")
    outsider = site("reader", "candidate")
    path, qid, route = discussion(user)
    item = save(user, path, qid, route)
    assert item["analysis"]["identifiers"] == ["item"]
    assert [p["label"] for p in item["analysis"]["phrases"]] == [
        "Reason",
        "Example or boundary",
    ]
    assert all(p["quote"] in REPLY for p in item["analysis"]["phrases"])
    assert user.put(route + "/1", json={"text": REPLY}).json() == item
    assert not user.get(path).json()["score"]
    review = route + "/1/review"
    sharing = route + "/1/sharing"
    assert user.put(sharing, json={"shared": True}).status_code == 409
    assert user.post(review, json={}).status_code == 422
    assert outsider.post(review, json={"share_explanation": True}).status_code == 404
    monkeypatch.setenv("MATRIX_REVIEW_MODEL", "test-model")
    monkeypatch.setenv("MATRIX_REVIEW_KEY", "synthetic")
    note = {
        "coverage": "partially addresses question",
        "quote": "not in the answer",
        "observation": "The reply describes what happens on empty input.",
        "next_question": "What happens when the input contains duplicates?",
    }
    calls = []

    def provider(_system, payload, *args):
        calls.append(payload)
        return note

    monkeypatch.setattr(followups, "request_json", provider)
    assert user.post(review, json={"share_explanation": True}).status_code == 503
    assert user.get(route).json()["turns"][0]["model_review"] is None
    note["quote"] = "an empty input produces no lines"
    stored = user.post(review, json={"share_explanation": True}).json()
    assert stored["quote"] == note["quote"]
    assert user.post(review, json={"share_explanation": True}).json() == stored
    assert len(calls) == 2 and set(calls[0]) == {"question", "code_structure", "answer"}
    assert user.get(route).json()["turns"][0]["model_review"] == stored
    with db(True) as c:
        c.execute("DELETE FROM explanation_review")
    assert user.get(route).json()["turns"][0]["analysis"] == item["analysis"]


def test_sharing_is_explicit_scoped_revocable_and_expires(site):
    recruiter, other, candidate, app, _ = pipeline(site)
    version = catalog(candidate, "coding")["id"]
    invite = post(
        recruiter, app + "/invitations", {"version": version, "expires": now() + 3600}
    )
    post(candidate, "/invitations/accept", {"token": invite["token"]})
    attempt = post(
        candidate,
        "/attempts",
        {
            "version": version,
            "invitation": invite["id"],
            "request_key": "assigned-coding",
        },
    )["id"]
    path = P + "/attempts/" + attempt
    question = candidate.get(path).json()["questions"][0]["id"]
    route = path + "/questions/" + question + "/follow-ups"
    save(candidate, path, question, route)
    url = route + "/1/sharing"
    shared = P + app + "/shared-explanations"
    assert candidate.put(url, json={"shared": True}).status_code == 409
    with db(True) as c:
        c.execute(
            "UPDATE assessment_attempt SET status='complete',score=1,total=3 WHERE id=?",
            (attempt,),
        )
    assert recruiter.get(shared).json() == []
    assert (
        other.get(shared).status_code == 404
        and candidate.get(shared).status_code == 403
    )
    assert (
        site("intruder", "candidate").put(url, json={"shared": True}).status_code == 404
    )
    assert candidate.put(url, json={"shared": True}).is_success
    (result,) = recruiter.get(shared).json()
    assert result["reply"] == REPLY and result["excerpt"] == "for item in items:"
    assert "model_review" not in result and "local_result" not in result
    assert (
        candidate.put(url, json={"shared": False}).is_success
        and recruiter.get(shared).json() == []
    )
    assert candidate.put(url, json={"shared": True}).is_success
    with db(True) as c:
        c.execute(
            "UPDATE assessment_attempt SET started=? WHERE id=?",
            (now() - 90 * 86400, attempt),
        )
    assert (
        recruiter.get(shared).json() == [] and candidate.get(route).status_code == 410
    )
