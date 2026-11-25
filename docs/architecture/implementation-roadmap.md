# Implementation roadmap

This roadmap is ordered by risk reduction and product leverage. Complexity is
relative to the current prototype.

## P0 — make the system safe to extend

| Work | Complexity | Dependencies | Acceptance criteria |
|---|---:|---|---|
| Credential rotation and exposure decision | Low operationally / High if history rewrite | Account access | Historical credentials are revoked; replacement values live only in secret storage |
| Auth and organization boundary | High | PostgreSQL, Alembic | Unauthenticated requests fail; cross-tenant requests cannot read or write |
| Authoritative attempts and scoring | High | Assessment schema | Client cannot alter questions, answer keys, timing, or score |
| Path and payload validation | Medium | API v1 boundary | All identifiers are allowlisted/validated; size and rate limits are enforced |
| Safe evaluation rendering | Low | Frontend rendering choice | No raw model HTML reaches the DOM |
| Security test baseline | Medium | Auth and schema | Pytest covers the P0 threat cases |

## P1 — retain and strengthen core product value

| Work | Complexity | Dependencies | Acceptance criteria |
|---|---:|---|---|
| Assessment versioning and assignment | High | P0 database | Published attempts remain reproducible after edits |
| Candidate dashboard read model | Medium | Attempt schema | Dashboard metrics are paginated, authorized, and derived from stored results |
| Monaco coding editor | Medium | Frontend routing | Python indentation, paste, undo/redo, and keyboard access work |
| Isolated code runner | High | Attempt schema | Code execution has no app credentials, bounded resources, or unrestricted network |
| Deterministic test-case scoring | High | Code runner | Pass/fail comes from execution results, not AI prose |
| AI provider abstraction | Medium | Celery, contracts | Provider adapter can be replaced without changing domain services |

## P2 — recruiter and explainability layer

| Work | Complexity | Dependencies | Acceptance criteria |
|---|---:|---|---|
| Jobs and criterion versions | High | Organization model | Recruiter can publish an immutable role rubric |
| Candidate applications and invitations | High | Auth, jobs | Candidate status and assignment lifecycle are auditable |
| Resume ingestion pipeline | High | S3, scanning, Celery | Uploads are private, scanned, bounded, and traceable |
| Structured resume facts | High | Extraction worker | Facts have source provenance and confidence |
| Explainable scoring | High | Criteria and facts | Every score has evidence, missing evidence, confidence, and version metadata |
| Human review and overrides | Medium | Evaluation schema | Recruiter decision is separate from AI recommendation and audited |

## P3 — differentiation and scale

| Work | Complexity | Dependencies | Acceptance criteria |
|---|---:|---|---|
| Microphone and interview readiness | Medium | Interview session model | Candidate receives a clear, accessible readiness result before starting |
| Adaptive assessment | High | Calibrated question metadata | Adaptation is bounded, fair, reproducible, and reviewable |
| Reviewer calibration | High | Structured reviews | Human/AI disagreement and agreement can be measured |
| RAG for maintained rubrics | Medium/high | Corpus governance | Retrieved sources are visible and cited in evaluations |
| Multi-provider AI routing | Medium | Provider abstraction | Routing respects policy, cost, privacy, and quality measurements |

## Delivery gates

Every milestone requires:

- Unit and integration tests.
- Security regression coverage.
- Migration and rollback notes.
- Observability fields.
- Privacy and retention review.
- Updated ADRs when a decision changes.

The roadmap deliberately postpones microservices, advanced orchestration, and
large AI feature expansion until identity, assessment integrity, and evidence
storage are reliable.
