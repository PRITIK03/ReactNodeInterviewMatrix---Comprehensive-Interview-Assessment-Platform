# ADR-004: Execute candidate code outside the application process

- Status: Proposed
- Date: 2026-11-25

## Context

The current coding flow sends code to Gemini but does not execute it. The target
product requires real execution and deterministic test results. Candidate code
is hostile input by definition.

## Decision

Use a separate runner service with ephemeral, non-root sandboxes, pinned runtime
images, strict CPU/memory/time/output limits, and default-deny networking. The
runner has no application database or object-store credentials.

## Alternatives rejected

- `exec` or subprocess in FastAPI: an application compromise becomes host
  compromise.
- Running code in the browser: cannot provide trusted assessment results.
- An external provider without a policy review: may not satisfy data, latency,
  language, or isolation requirements.

## Consequences

Execution results become an authoritative and testable scoring source. The runner
requires separate deployment, monitoring, image patching, queue controls, and
security review.
