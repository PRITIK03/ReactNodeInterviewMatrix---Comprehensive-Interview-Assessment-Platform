from backend import followups
from backend.store import db

SOURCE = 'for item in items:  # private comment\n    if item:\n        print("private literal")'


def discussion(client, kind="coding"):
    root = "/api/v1"
    version = next(
        v["id"] for v in client.get(root + "/assessments").json() if v["kind"] == kind
    )
    key = client.post(
        root + "/attempts",
        json={"version": version, "request_key": "discussion-" + kind},
    ).json()["id"]
    path = root + "/attempts/" + key
    qid = client.get(path).json()["questions"][0]["id"]
    return path, qid, path + "/questions/" + qid + "/follow-ups"


def test_draft_discussion_recovery_permissions_and_score(site):
    c = site("speaker", "candidate")
    other = site("observer", "candidate")
    path, qid, route = discussion(c)
    assert c.post(route, json={"turn": 1}).status_code == 422
    assert c.put(
        path + "/draft", json={"answers": [{"question_id": qid, "value": SOURCE}]}
    ).is_success
    assert other.get(route).status_code == 404
    assert other.post(route, json={"turn": 1}).status_code == 404
    assert c.get(route.replace(qid, "missing-question")).status_code == 404
    assert c.get(discussion(c, "aptitude")[2]).status_code == 404
    assert c.post(route, json={"turn": 1, "source": "untrusted"}).status_code == 422
    item = c.post(route, json={"turn": 1}).json()
    assert (
        item["line"] == 1
        and "for loop" in item["prompt"]
        and item["provider"] == "local"
    )
    assert c.post(route, json={"turn": 1}).json() == item
    assert c.post(route, json={"turn": 2}).status_code == 409
    assert other.put(route + "/1", json={"text": "value"}).status_code == 404
    assert c.put(route + "/1", json={"text": " "}).status_code == 422
    for _ in range(2):
        assert c.put(route + "/1", json={"text": "I visit every item once."}).is_success
    assert c.put(route + "/1", json={"text": "changed"}).status_code == 409
    assert c.get(route).json()["turns"][0]["reply"] == "I visit every item once."
    assert c.post(route, json={"turn": 2}).json()["line"] == 2
    assert c.get(path).json()["score"] is None
    with db(True) as conn:
        conn.execute(
            "UPDATE assessment_attempt SET expires=0 WHERE id=?", (path.split("/")[-1],)
        )
    assert c.put(route + "/2", json={"text": "late"}).status_code == 409
    assert c.post(route, json={"turn": 3}).status_code == 409


def test_gemini_questions_are_opt_in_bounded_and_cited(site, monkeypatch):
    c = site("reader", "candidate")
    path, qid, route = discussion(c)
    c.put(path + "/draft", json={"answers": [{"question_id": qid, "value": SOURCE}]})
    monkeypatch.delenv("MATRIX_REVIEW_KEY", raising=False)
    assert c.post(route, json={"turn": 1, "use_gemini": True}).status_code == 503
    monkeypatch.setenv("MATRIX_REVIEW_KEY", "synthetic")
    monkeypatch.setenv("MATRIX_REVIEW_MODEL", "fixture")

    def provider(_system, payload, *_args):
        assert "private" not in str(payload)
        return {"line": 27, "question": "What does this loop do?"}

    monkeypatch.setattr(followups, "request_json", provider)
    assert c.post(route, json={"turn": 1, "use_gemini": True}).status_code == 503
    assert c.get(route).json()["turns"] == []
    monkeypatch.setattr(
        followups,
        "request_json",
        lambda *_: {"line": 2, "question": "What happens if item is zero?"},
    )
    item = c.post(route, json={"turn": 1, "use_gemini": True}).json()
    assert item["provider"] == "gemini" and item["excerpt"] == "if item:"
    with db(True) as conn:
        conn.execute(
            "UPDATE assessment_attempt SET status='complete',score=2,total=3 WHERE id=?",
            (path.split("/")[-1],),
        )
    for turn in range(1, 5):
        assert c.post(route, json={"turn": turn}).is_success
        assert c.put(
            route + "/" + str(turn), json={"text": "A considered answer."}
        ).is_success
    assert c.post(route, json={"turn": 5}).status_code == 422
    assert c.get(path).json()["score"] == 2
    with db(True) as conn:
        conn.execute(
            "UPDATE assessment_attempt SET started=0 WHERE id=?", (path.split("/")[-1],)
        )
    assert c.get(route).status_code == 410


def test_partial_python_and_source_change(site, monkeypatch):
    c = site("revision", "candidate")
    path, qid, route = discussion(c)

    def draft(value):
        c.put(path + "/draft", json={"answers": [{"question_id": qid, "value": value}]})

    draft("total = (")
    monkeypatch.setenv("MATRIX_REVIEW_KEY", "synthetic")
    monkeypatch.setenv("MATRIX_REVIEW_MODEL", "fixture")

    def changed(*args):
        draft("count = 1")
        return {"line": 1, "question": "What does total represent here?"}

    monkeypatch.setattr(followups, "request_json", changed)
    assert c.post(route, json={"turn": 1, "use_gemini": True}).status_code == 409
    assert "count" in c.post(route, json={"turn": 1}).json()["prompt"]


def test_practice_followups_ground_algorithm_questions_in_call_tokens():
    examples = [
        ("ordered = sorted(sessions)", "ordering"),
        ("times.sort()", "ordering"),
        ("start = bisect_right(ends, minute)", "boundary"),
        ("first = heapq.heappop(queue)", "heap"),
        ("unique = set(values)", "repeated"),
    ]
    for source, focus in examples:
        anchor = followups.anchors(source)[0]
        assert focus in followups.local_question(anchor, 1)
    for source in (
        'label = "sorted(values)"',
        "value = sorted_count  # sorted(values)",
    ):
        assert "ordering" not in followups.local_question(
            followups.anchors(source)[0], 1
        )
