# ADR-002: Use PostgreSQL as the system of record

- Status: Proposed
- Date: 2026-11-25

## Context

The current backend stores accounts, profiles, and attempts in JSON files. The
target product needs tenant isolation, transactions, recruiter queries,
versioned assessments, review history, and concurrent writes.

## Decision

Use PostgreSQL with SQLAlchemy 2 and Alembic. Use relational tables for identity,
ownership, attempts, scores, evidence, and audit events. Use JSONB only for
provider-specific raw payloads or flexible metadata.

## Alternatives rejected

- Continue with JSON: unsafe concurrent writes and no query/authorization model.
- Document database first: less natural for relational tenant, assignment,
  review, and audit relationships.

## Consequences

The product gains transactions, constraints, migrations, and efficient recruiter
queries. It requires a migration, backup, connection-pool, and operational plan.
