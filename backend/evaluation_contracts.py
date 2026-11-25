"""Constrained claims. Free prose never contributes to a score."""

from fractions import Fraction
from typing import Literal
from pydantic import Field
from .access import Strict


class Citation(Strict):
    ref: str = Field(max_length=100)
    page: int | None


class Finding(Strict):
    criterion_id: str = Field(max_length=16)
    score: int | None = Field(ge=0, le=100)
    confidence: Literal["observed", "uncertain"]
    evidence: list[Citation] = Field(max_length=1)
    explanation: Literal[
        "Published evidence rule met",
        "Recorded assessment performance",
        "Human interpretation required",
    ]
    missing_evidence: Literal["none", "insufficient verified evidence"]
    limitations: Literal[
        "literal evidence only",
        "limited to assigned assessment",
        "manual review required",
    ]
    review_flags: list[Literal["verify context", "insufficient evidence"]] = Field(
        max_length=2
    )


class Findings(Strict):
    criteria: list[Finding] = Field(max_length=20)


def expected_finding(cid, criterion, item):
    e = item["source"]
    score = item["supported_score"]
    quantitative = criterion["evaluation_type"] in ("aptitude", "coding")
    return Finding(
        criterion_id=cid,
        score=score,
        confidence="uncertain" if score is None else "observed",
        evidence=[Citation(ref=e["ref"], page=e["page"])] if e else [],
        explanation="Human interpretation required"
        if score is None
        else (
            "Recorded assessment performance"
            if quantitative
            else "Published evidence rule met"
        ),
        missing_evidence="insufficient verified evidence" if score is None else "none",
        limitations="manual review required"
        if score is None
        else (
            "limited to assigned assessment"
            if quantitative
            else "literal evidence only"
        ),
        review_flags=["insufficient evidence"] if score is None else ["verify context"],
    )


def validate_response(raw, ctx):
    result = Findings.model_validate(raw)
    ids = [f.criterion_id for f in result.criteria]
    if len(ids) != len(set(ids)) or set(ids) != set(ctx["rubric"]):
        raise ValueError("Wrong criterion set")
    for f in result.criteria:
        item = ctx["eligible"][f.criterion_id]
        accepted = expected_finding(f.criterion_id, ctx["rubric"][f.criterion_id], item)
        abstained = expected_finding(
            f.criterion_id,
            ctx["rubric"][f.criterion_id],
            {**item, "supported_score": None},
        )
        if f != accepted and f != abstained:
            raise ValueError("Unsupported claim or evidence reference")
    return result


def aggregate(scores, rubric):
    included = [
        (Fraction(scores[k] * 100, r["scale"]), r["weight"])
        for k, r in rubric.items()
        if scores.get(k) is not None
    ]
    weight = sum(w for _, w in included)
    complete = bool(rubric) and len(included) == len(rubric)
    return {
        "score_percent": float(round(sum(s * w for s, w in included) / weight, 2))
        if complete
        else None,
        "covered_weight": weight,
        "scope_weight": sum(r["weight"] for r in rubric.values()),
    }
