# Migration plan from prototype to modular monolith

The migration is additive and staged. Existing staged cleanup changes must be
preserved. No application source migration should begin until the documentation
is reviewed and the historical secret-remediation decision is made.

## Phase 0 — documentation and safety

Deliverables:

- Architecture and domain model.
- AI evaluation contract.
- Security assessment.
- ADRs.
- Dependency and deployment inventory.
- Approved data-retention and tenant model.

Exit criteria:

- Product owner confirms candidate/recruiter MVP boundary.
- Security owner confirms credential rotation status.
- Database and object-storage environments are available.
- No source behavior is changed by documentation work.

## Phase 1 — secure foundation

Build in this order:

1. PostgreSQL, SQLAlchemy 2, and Alembic baseline.
2. Organization, user, membership, candidate, and session tables.
3. Argon2id password hashing and session lifecycle.
4. FastAPI dependencies for authentication and organization scope.
5. Central error model, request IDs, structured logs, and rate limits.
6. API versioning under `/api/v1`.
7. Pytest fixtures for identity and tenant isolation.

Do not migrate old plaintext accounts as active credentials. Existing local
profile data should be treated as untrusted migration input and either anonymized
or imported only after explicit review.

## Phase 2 — assessments and authoritative scoring

1. Model assessment, assessment version, section, question version, assignment,
   attempt, answer, and scoring policy.
2. Import static question banks into a controlled seed process.
3. Create server-authoritative attempts.
4. Remove client-supplied question objects from submission commands.
5. Add attempt finalization and idempotency.
6. Migrate candidate dashboard queries to database read models.
7. Add Vitest component and workflow tests.

The old JSON question files may remain as seed source temporarily, but runtime
reads should move behind an application repository.

## Phase 3 — coding execution and editor

1. Introduce Monaco Editor in the coding assessment UI.
2. Create code submission and execution-run records.
3. Build or integrate a restricted execution service.
4. Execute immutable test cases with resource limits.
5. Store deterministic execution results.
6. Add AI review only as a separate explanatory layer.

The FastAPI process must never execute candidate code and must never receive
runner host credentials.

## Phase 4 — recruiter workflow

1. Jobs and published criterion versions.
2. Candidate records and applications.
3. Assessment assignments and invitations.
4. Recruiter workspace and review queues.
5. Human notes, overrides, and audit events.
6. Organization-scoped analytics.

## Phase 5 — resumes and explainable evaluation

1. Private S3-compatible object storage.
2. Upload, checksum, scanning, and retention metadata.
3. Celery extraction jobs.
4. Structured candidate facts.
5. Versioned evaluation criteria.
6. Provider abstraction and Pydantic evaluation contracts.
7. Evidence spans and reviewer decisions.
8. Quality benchmark and model-version rollout process.

## Phase 6 — interview readiness

1. Interview session and readiness-check records.
2. Browser microphone preflight.
3. Device selection and input-level visualization.
4. Optional recording only after consent and retention design.
5. Recovery and reconnect behavior.

## Phase 7 — operational maturity

- Redis/Celery production topology.
- Observability, alerting, and cost dashboards.
- CI with tests, secret scanning, dependency scanning, and migrations.
- Container hardening and deployment automation.
- Backup/restore and deletion verification.
- Load testing for assessments and AI jobs.

## Data migration rules

- Never copy secrets or plaintext passwords into the new database.
- Preserve source provenance for imported question content.
- Mark imported profile data as legacy and require a retention decision.
- Recalculate scores only from authoritative question versions where possible.
- Keep migration scripts idempotent and read-only by default.
- Validate row counts, checksums, ownership, and tenant scopes before cutover.

## Rollback strategy

Each phase should be deployable behind a feature flag or separate route version.
Database migrations must be backward-compatible for at least one deployment
window. Data writes should use dual-write only when reconciliation and rollback
are tested; otherwise prefer a clean cutover with an import checkpoint.
