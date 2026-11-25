import json
from itertools import combinations, permutations
from pathlib import Path

from test_workflows import P, assessment, pipeline, post

from backend import store


def test_republishing_preserves_started_attempt(site, monkeypatch):
    user = site("edition", "candidate")
    path, original = assessment(user, "aptitude")
    monkeypatch.setitem(store.PRACTICE_FORMATS["aptitude"], "beginner", (9, 17))
    store.initialize()
    store.initialize()
    catalog = user.get(P + "/assessments?current_only=true&limit=100").json()
    version = next(
        v
        for v in catalog
        if (v["company"], v["kind"], v["level"]) == ("wipro", "aptitude", "beginner")
    )
    assert (version["minutes"], version["question_count"]) == (17, 9)
    key = post(
        user, "/attempts", {"version": version["id"], "request_key": "republished"}
    )["id"]
    latest = user.get(P + "/attempts/" + key).json()
    assert 1019 <= latest["expires"] - latest["started"] <= 1020
    assert len(latest["questions"]) == 9
    recovered = user.get(P + path).json()
    assert recovered["version"] != latest["version"]
    assert recovered["expires"] == original["expires"]
    assert len(recovered["questions"]) == 15
    assert {q["id"] for q in latest["questions"]} <= {
        q["id"] for q in recovered["questions"]
    }


def test_catalog_formats_and_public_preview(site):
    client = site("formats", "candidate")
    catalog = client.get(P + "/assessments?current_only=true&limit=100").json()
    assert len(catalog) == 30
    for row in catalog:
        assert (row["question_count"], row["minutes"]) == store.PRACTICE_FORMATS[
            row["kind"]
        ][row["level"]]
        assert set(row) <= {
            "id",
            "company",
            "kind",
            "level",
            "minutes",
            "question_count",
            "first_task",
        }
        if row["kind"] == "coding":
            assert row["first_task"]
    capstones = {
        v["first_task"]
        for v in catalog
        if v["kind"] == "coding" and v["level"] == "advanced"
    }
    assert len(capstones) == 5


def test_daily_completions_respect_utc_window_and_owner(site, monkeypatch):
    candidate = site("activity", "candidate")
    outsider = site("separate", "candidate")
    today = 21000 * 86400
    monkeypatch.setattr("backend.workspace.now", lambda: today + 450)
    path, attempt = assessment(candidate, "aptitude")
    post(
        candidate,
        path + "/submit",
        {
            "answers": [
                {"question_id": q["id"], "value": q["options"][0]}
                for q in attempt["questions"]
            ]
        },
    )
    with store.db(True) as conn:
        conn.execute(
            "UPDATE assessment_attempt SET submitted=? WHERE id=?",
            (today - 13 * 86400, attempt["id"]),
        )
    view = candidate.get(P + "/overview").json()
    assert view["last_result"]["id"] == attempt["id"]
    assert view["activity"] == [
        {"day": today - (13 - i) * 86400, "count": int(i == 0)} for i in range(14)
    ]
    other = outsider.get(P + "/overview").json()
    assert (
        sum(d["count"] for d in other["activity"]) == 0 and other["last_result"] is None
    )
    with store.db(True) as conn:
        conn.execute("UPDATE assessment_attempt SET submitted=submitted-1")
    assert (
        sum(d["count"] for d in candidate.get(P + "/overview").json()["activity"]) == 0
    )


def test_stage_counts_follow_transitions_and_tenants(site):
    recruiter, outsider, candidate, path, _ = pipeline(site)
    post(recruiter, path + "/stage", {"stage": "review"})
    assert recruiter.get(P + "/overview").json()["stages"] == {"review": 1}
    assert outsider.get(P + "/overview").json()["stages"] == {}
    assert "stages" not in candidate.get(P + "/overview").json()


def test_capstone_cases_agree_with_independent_small_oracles():
    for path in (Path(__file__).resolve().parents[1] / "data/coding").glob("*.json"):
        (task,) = (
            q
            for q in json.loads(path.read_text(encoding="utf8"))["advanced"]
            if q.get("capstone")
        )
        for case in task["test_cases"]:
            numbers = list(map(int, case["input"].split()))
            n = numbers[0]
            rows = [
                tuple(map(int, line.split())) for line in case["input"].splitlines()[1:]
            ]
            if path.stem == "accenture":
                answer = max(
                    (sum(start <= t < end for start, end in rows) for t in range(1440)),
                    default=0,
                )
            elif path.stem == "amazon":
                _, width, *timestamps = numbers
                answer = max(
                    (sum(t <= x < t + width for x in timestamps) for t in timestamps),
                    default=0,
                )
            elif path.stem == "infosys":
                valid = next(
                    (
                        order
                        for order in permutations(range(1, n + 1))
                        if all(order.index(a) < order.index(b) for a, b in rows)
                    ),
                    None,
                )
                answer = " ".join(map(str, valid)) if valid else "IMPOSSIBLE"
            elif path.stem == "tcs":
                answer = len({m for a, b in rows for m in range(a, b)})
            elif path.stem == "wipro":
                answer = max(
                    sum(p for _, _, p in group)
                    for k in range(n + 1)
                    for group in combinations(rows, k)
                    if all(
                        b <= c or d <= a
                        for (a, b, _), (c, d, _) in combinations(group, 2)
                    )
                )
            else:
                raise AssertionError("Missing capstone oracle")
            assert str(answer) == case["output"].strip(), (path.stem, case)
