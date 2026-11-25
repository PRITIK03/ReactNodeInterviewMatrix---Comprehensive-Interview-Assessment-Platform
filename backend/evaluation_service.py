import json
from fastapi import HTTPException
from .evaluation_context import context
from .evaluation_contracts import aggregate
from .evaluation_provider import PROMPT, ProviderError, evaluate
from .store import db, now, uid
from .workspace import require


def permitted(c, key, provider):
    if (
        provider == "gemini"
        and not c.execute(
            "SELECT 1 FROM evaluation_permission WHERE application=?", (key,)
        ).fetchone()
    ):
        raise HTTPException(
            403, "Candidate permission for external evaluation is required"
        )


def generate(key, user, scope, provider, correlation):
    with db(True) as c:
        ctx = context(c, key, user, scope)
        if not ctx["rubric"]:
            raise HTTPException(422, "No published criteria in this scope")
        permitted(c, key, provider)
        if (
            c.execute(
                "SELECT count(*) FROM provider_call WHERE org=? AND at>?",
                (user["org"], now() - 60),
            ).fetchone()[0]
            >= 15
        ):
            raise HTTPException(429, "Evaluation request limit reached")
        c.execute(
            "INSERT INTO provider_call VALUES(?,?,?,'pending',0,0,0,NULL)",
            (correlation, user["org"], now()),
        )
    try:
        result, model = evaluate(ctx, provider, user["org"], correlation)
    except ProviderError as exc:
        raise HTTPException(502, "Evaluation unavailable: " + str(exc)) from None
    with db(True) as c:
        current = context(c, key, user, scope)
        permitted(c, key, provider)
        if current["fingerprint"] != ctx["fingerprint"]:
            raise HTTPException(409, "Sources changed during evaluation")
        eid = uid()
        expiry = min(
            [now() + 90 * 86400]
            + [
                v["source"]["expires"]
                for v in ctx["eligible"].values()
                if v["source"] and "expires" in v["source"]
            ]
        )
        c.execute(
            "INSERT INTO evaluation VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                eid,
                key,
                ctx["version"],
                scope,
                provider,
                model,
                PROMPT,
                ctx["fingerprint"],
                now(),
                result.model_dump_json(),
                expiry,
                correlation,
            ),
        )
        return {"id": eid}


def load_card(c, eid, user):
    row = require(
        c.execute(
            "SELECT * FROM evaluation WHERE id=? AND expires>?", (eid, now())
        ).fetchone()
    )
    ctx = context(c, row["application"], user, row["scope"])
    stale = ctx["fingerprint"] != row["fingerprint"]
    scorecard = json.loads(row["result"])["criteria"]
    history = [
        dict(r)
        for r in c.execute(
            "SELECT id,actor,at,criterion,action,original,revised,reason FROM evaluation_event WHERE evaluation=? ORDER BY id",
            (eid,),
        )
    ]
    accepted = {}
    for event in history:
        if event["action"] in ("accept", "override"):
            accepted[event["criterion"]] = event["revised"]
    scores = {}
    for f in scorecard:
        k = f["criterion_id"]
        scores[k] = f["score"]
        f["rubric"] = ctx["rubric"][k]
        f["approved"] = k in accepted
        f["reviewed_score"] = accepted.get(k)
        f["source"] = None if stale else ctx["eligible"][k]["source"]
    return {
        "id": eid,
        "version": row["version"],
        "scope": row["scope"],
        "provider": row["provider"],
        "model": row["model"],
        "prompt": row["prompt"],
        "stale": stale,
        "criteria": scorecard,
        "history": history,
        "reference_aggregate": aggregate(scores, ctx["rubric"]),
        "reviewed_aggregate": aggregate(accepted, ctx["rubric"]),
        "revision": len(history),
    }


def review(eid, user, body):
    with db(True) as c:
        card = load_card(c, eid, user)
        if card["stale"] or card["revision"] != body.revision:
            raise HTTPException(409, "Reload or regenerate the scorecard")
        if any(
            e["action"] in ("review_complete", "request_information")
            for e in card["history"]
        ):
            raise HTTPException(409, "Review is finalized")
        by_id = {f["criterion_id"]: f for f in card["criteria"]}
        f = by_id.get(body.criterion)
        old = new = None
        if body.action in ("accept", "override"):
            if not f:
                raise HTTPException(422, "Select an active criterion")
            old = f["reviewed_score"] if f["approved"] else f["score"]
            new = f["score"] if body.action == "accept" else body.value
            if new is None or not 0 <= new <= f["rubric"]["scale"]:
                raise HTTPException(422, "A score within the rubric scale is required")
            if body.action == "override" and not f["source"]:
                raise HTTPException(
                    422, "Provide source evidence before assigning a score"
                )
            if any(
                x["approved"]
                and x["criterion_id"] != body.criterion
                and x["source"]
                and f["source"]
                and x["source"]["ref"] == f["source"]["ref"]
                for x in by_id.values()
            ):
                raise HTTPException(409, "Evidence already scored")
        elif body.criterion or body.value is not None:
            raise HTTPException(422, "This action applies to the whole review")
        if body.action == "review_complete" and not all(
            x["approved"] for x in by_id.values()
        ):
            raise HTTPException(409, "Review every criterion or request information")
        c.execute(
            "INSERT INTO evaluation_event(evaluation,actor,at,criterion,action,original,revised,reason) VALUES(?,?,?,?,?,?,?,?)",
            (
                eid,
                user["id"],
                now(),
                body.criterion,
                body.action,
                old,
                new,
                body.reason,
            ),
        )
        return {"revision": body.revision + 1}
