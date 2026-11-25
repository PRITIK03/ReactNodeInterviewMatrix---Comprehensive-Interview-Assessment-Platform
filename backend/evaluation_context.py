"""Build a bounded manifest from job-version and application-owned sources."""

import ast
import json
import re
from fractions import Fraction
from .store import digest, now
from .workspace import Criterion, application

RESUME = {"education", "skills", "employment", "projects"}
ASSESSMENT = {"aptitude", "coding", "code_review"}


def criteria_for(c, version, scope):
    items = json.loads(
        c.execute(
            "SELECT criteria FROM job_version WHERE id=? AND status='published'",
            (version,),
        ).fetchone()[0]
    )
    rubric = {}
    for pos, item in enumerate(items):
        criterion = Criterion.model_validate(item).model_dump()
        kind = criterion["evaluation_type"]
        if (
            scope == "combined"
            or (scope == "resume" and kind in RESUME)
            or (scope == "assessment" and kind in ASSESSMENT)
        ):
            rubric[f"c{pos + 1}"] = criterion
    return rubric


def resume_sources(c, key):
    sources = []
    for doc in c.execute(
        "SELECT id,generation,facts,expires FROM resume WHERE application=? AND status IN ('ready','needs_review') AND expires>? ORDER BY created DESC,id LIMIT 10",
        (key, now()),
    ):
        corrected = {
            r[0]
            for r in c.execute(
                "SELECT field FROM correction WHERE resume=? AND generation=?",
                (doc["id"], doc["generation"]),
            )
        }
        for section, items in json.loads(doc["facts"]).items():
            if section not in RESUME or section in corrected:
                continue
            for fact in items[:100]:
                e = fact["evidence"]
                if (
                    fact["status"] != "explicit"
                    or e["document_id"] != doc["id"]
                    or e["excerpt"] != fact["value"]
                ):
                    continue
                if len(e["excerpt"]) > 350:
                    continue
                ref = digest(
                    json.dumps(
                        [
                            doc["id"],
                            doc["generation"],
                            section,
                            e["page"],
                            e["start"],
                            e["end"],
                            e["excerpt"],
                        ]
                    )
                )
                sources.append(
                    {
                        "ref": ref,
                        "kind": section,
                        "text": e["excerpt"],
                        "page": e["page"],
                        "start": e["start"],
                        "end": e["end"],
                        "method": e["method"],
                        "document": doc["id"],
                        "generation": doc["generation"],
                        "expires": doc["expires"],
                        "quality": fact["confidence"],
                    }
                )
    return sources


def assessment_sources(c, key):
    sources = []
    seen = set()
    rows = c.execute(
        """SELECT a.id,a.version,a.score,a.total,t.kind FROM invitation i JOIN assessment_attempt a ON a.invitation=i.id
        JOIN assessment_version v ON v.id=a.version JOIN assessment_template t ON t.id=v.template
        WHERE i.application=? AND a.status='complete' ORDER BY a.submitted DESC,a.id""",
        (key,),
    )
    for row in rows:
        kind = row["kind"]
        if kind in seen or not row["total"]:
            continue
        seen.add(kind)
        base = {
            "attempt": row["id"],
            "version": row["version"],
            "quality": "verified",
            "page": None,
        }
        cases = [
            dict(r)
            for r in c.execute(
                """SELECT s.question,t.position,t.hidden,t.status,t.engine FROM code_submission s
            JOIN execution_run e ON e.submission=s.id JOIN test_case_result t ON t.run=e.id WHERE s.attempt=? ORDER BY s.question,t.position""",
                (row["id"],),
            )
        ]
        sources.append(
            {
                **base,
                "ref": row["id"] + "-" + kind,
                "kind": kind,
                "score": row["score"],
                "total": row["total"],
                "text": f"{row['score']} of {row['total']}",
                "cases": cases,
            }
        )
        if kind == "coding":
            for code in c.execute(
                "SELECT id,source,question FROM code_submission WHERE attempt=? ORDER BY id",
                (row["id"],),
            ):
                try:
                    tree = ast.parse(code["source"])
                except (SyntaxError, ValueError, RecursionError):
                    continue
                for node in ast.walk(tree):
                    if isinstance(
                        node, (ast.FunctionDef, ast.AsyncFunctionDef)
                    ) and ast.get_docstring(node):
                        sources.append(
                            {
                                **base,
                                "ref": code["id"] + "-docstring",
                                "kind": "code_review",
                                "text": "Documented function",
                                "question": code["question"],
                                "line": node.lineno,
                            }
                        )
                        break
    return sources


def context(c, key, user, scope):
    a = application(c, key, user)
    rubric = criteria_for(c, a["job_version"], scope)
    sources = (resume_sources(c, key) if scope != "assessment" else []) + (
        assessment_sources(c, key) if scope != "resume" else []
    )
    eligible = {}
    for cid, r in rubric.items():
        kind = r["evaluation_type"]
        target = (r["required_evidence"] or r["name"]).strip().casefold()
        candidates = [e for e in sources if e["kind"] == kind]
        exact = True
        if kind in RESUME or kind == "code_review":
            section_entries = candidates
            candidates = [
                e for e in candidates if e["text"].strip().casefold() == target
            ]
            if not candidates and target and kind in RESUME:
                phrase = re.compile(r"(?<!\w)" + re.escape(target) + r"(?!\w)")
                candidates = [
                    e for e in section_entries if phrase.search(e["text"].casefold())
                ]
                exact = False
        elif r["required_evidence"].strip().casefold() not in (
            "",
            "completed assessment",
        ):
            candidates = []
        e = candidates[0] if candidates else None
        score = None
        if (
            e
            and exact
            and r["instructions"] != "require human confirmation"
            and e["quality"] != "review"
        ):
            score = round(Fraction(e.get("score", 1) * r["scale"], e.get("total", 1)))
        eligible[cid] = {"source": e, "supported_score": score, "exact": exact}
    # An evidence item can contribute to at most one criterion. A reviewer resolves overlaps.
    refs = [v["source"]["ref"] for v in eligible.values() if v["source"]]
    for v in eligible.values():
        if v["source"] and refs.count(v["source"]["ref"]) > 1:
            v["supported_score"] = None
    data = {"version": a["job_version"], "rubric": rubric, "eligible": eligible}
    data["fingerprint"] = digest(json.dumps(data, sort_keys=True))
    return data
