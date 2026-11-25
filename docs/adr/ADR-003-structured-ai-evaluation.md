# ADR-003: Treat AI output as versioned structured data

- Status: Proposed
- Date: 2026-11-25

## Context

The current Gemini integration returns free-form text and the frontend parses
formatting conventions. Hiring-related evaluation needs evidence, confidence,
criteria versions, and reviewer decisions.

## Decision

All AI evaluators return versioned Pydantic contracts. Provider calls are made
through an abstraction that records model, prompt version, input/output hashes,
latency, token usage, and validation status. Invalid output is retried within a
bound or escalated to human review.

## Alternatives rejected

- Continue parsing markdown: fragile and not reliably auditable.
- Let AI make automatic hiring decisions: unacceptable for explainability,
  reviewability, and product risk.
- Add LangChain immediately: no current requirement justifies another abstraction
  before the evaluation contract is stable.

## Consequences

Evaluation results can be tested, compared, reviewed, and reproduced. Prompt and
schema versioning become part of the release process. Provider integration takes
more design work than a direct SDK call but reduces long-term coupling.
