# ADR-005: Enforce tenant isolation and preserve human decisions

- Status: Proposed
- Date: 2026-11-25

## Context

The target combines recruiter workspaces with candidate data and AI-assisted
evaluation. The current API trusts usernames supplied by the client and has no
organization model.

## Decision

Organizations are the recruiter data boundary. Every organization-owned query,
object key, background job, and analytics read is scoped by authenticated
organization context. AI recommendations, evidence, and confidence are stored
separately from recruiter decisions. A recruiter can accept, override, or
annotate an evaluation, and every action becomes an audit event.

## Alternatives rejected

- Username-only access: not an authorization boundary.
- One global recruiter namespace: risks cross-company disclosure.
- AI-only hiring decisions: removes accountability and explainability.

## Consequences

Authorization becomes explicit and testable. The schema and UI have more state,
but candidate privacy, reviewer accountability, and explainable workflows become
part of the product rather than afterthoughts.
