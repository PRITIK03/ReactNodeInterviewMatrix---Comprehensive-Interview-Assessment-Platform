# ADR-001: Use a modular monolith for the first production architecture

- Status: Proposed
- Date: 2026-11-25

## Context

The current application is a small React/FastAPI prototype. The target product
adds recruiters, candidates, resumes, assessments, AI evaluation, code execution,
and interview readiness. The domain is changing and the team is small.

## Decision

Use one FastAPI deployable with explicit modules and application services. Run
slow work in Celery workers. Keep code execution in a separate isolated service.

## Alternatives rejected

- Microservices now: too much deployment and distributed-data complexity before
  boundaries are proven.
- A single unstructured route module: preserves the current coupling and makes
  authorization and testing difficult.

## Consequences

The monolith is simpler to deploy and transact across related domain changes.
Module boundaries, queues, and typed contracts preserve a later extraction path.
The team must enforce import and ownership rules so the monolith does not become
another shared global module.
