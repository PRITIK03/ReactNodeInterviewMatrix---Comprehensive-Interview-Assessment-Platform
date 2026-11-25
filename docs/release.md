# Controlled demonstration and release verification

## Local setup and walkthrough

Use the Windows bootstrap in the [README](../README.md). SQLite, private objects and the optional local queue live under the ignored runtime directory. Public-demo services are separate from that working copy.

1. Publish a synthetic job with **Python**, a skills criterion with required evidence **Python**, scale 5 and weight 40. Add **Aptitude** with type **aptitude**, scale 10 and weight 60. Create the candidate, application and aptitude invitation.
2. Claim the private code in the candidate account. Enable recruiter upload for the application, or upload a fictional resume directly. On a new candidate record, invitation claim establishes account ownership before recruiter-upload consent can be recorded.
3. Complete the assigned aptitude assessment. Open **Readiness** to check a microphone, or choose a Python practice assessment to demonstrate Monaco and the sandbox.
4. In the recruiter application, generate a **combined** scorecard using **Published evidence rules**. Open the Python source excerpt and the assessment record. Accept one criterion, override the other with a reason, then record the reviewer disposition. Compare the proposed and reviewed scores and open the review history.
5. To rehearse the complete running stack with fresh synthetic accounts, run `python scripts/verify_live.py` using the project’s test virtual environment. The rehearsal removes its synthetic document at the end. Its synthetic accounts and job remain in the local demo database.

## Workspace design contract and audit

The candidate and recruiter workspaces share a horizontal index. The practice library uses an answer sheet and Python source listing as recognizable track covers. Reading views use Instrument Serif for display and locally served Instrument Sans for controls and body text. Recruitment tables, review ledgers and question navigation use compact rows. Forms expand when needed.

| Review | Applied decision and verification |
| --- | --- |
| Visual identity | Flat paper and ink surfaces, vermilion actions, ochre aptitude and green coding covers. Logo files and fonts resolve locally. |
| Hierarchy and density | One level of covers in the library. Hairlines separate sections, criteria, citations and history. Empty tables omit their headers, and short lists omit pagination. |
| Typography | The font assets ship in the build. Form labels stay visible while filled. Time and scoring remain readable at narrow widths. |
| Color | The paired body, muted, primary-action and status text colors each exceed 6:1 against their intended surfaces. Text, symbols and labels communicate state alongside color. These measurements cover the specified pairs. |
| Real states | An unauthorized session opens sign-in. An unavailable workspace offers retry. The library distinguishes loading, empty and available tracks. Disabled actions, saved replies and expiring attempts have distinct states. |
| Motion and input | Short transitions respond to selecting a section or hovering a cover. Reduced-motion mode removes animations and transitions. A skip link, focus outlines and native inputs support keyboard navigation. |

The attempt API returns server time alongside its deadline. The worksheet measures elapsed time locally and checks the private attempt clock when a background tab returns. The server validates every deadline-sensitive write. After an ambiguous start response, retrying the same selection within the workspace reuses its request key.

## API and operations

| Operation | Route under `/api/v1` | Authority |
| --- | --- | --- |
| Publish rubric revision | `POST /jobs/{job}/versions` | Owning organization |
| Allow or withdraw external evaluation | `PUT /applications/{id}/evaluation-permission` | Owning candidate |
| List or generate scorecards | `GET/POST /applications/{id}/evaluations` | Owning recruiter |
| Discuss one Python solution | `GET/POST /attempts/{attempt}/questions/{question}/follow-ups`, `PUT .../follow-ups/{turn}` | Owning candidate |
| Resolve a scorecard and citations | `GET /evaluations/{id}` | Owning recruiter |
| Append a review event | `POST /evaluations/{id}/review` | Owning recruiter and matching revision |
| Inspect operational summaries | `GET /operations` | Recruiter, tenant-scoped results and shared worker heartbeat |

`GET /api/health` checks a database table. API logs contain route templates, request IDs, status and latency. A database heartbeat scheduled every minute records whether a worker processed a recent pulse. The operations response includes document status counts, execution verdicts and the latest 50 evaluation calls. Logs and metrics omit request bodies, passwords, tokens, audio, resume text and candidate source. Configure your monitoring system to alert on elevated 5xx rates, missing worker pulses, growing failures and runner availability.

## Container deployment

The Compose profile builds a static frontend with Nginx, FastAPI, a Celery worker, Celery Beat and a dedicated WASI runner. PostgreSQL and Redis have private service networks. Only the frontend publishes a host port, bound to loopback. The runner has a read-only root, temporary storage, process/memory/CPU limits, no published port and an internal network. Its API authenticates the application and starts a fresh capability-limited guest per case. Production must protect this private transport between hosts.

Supply settings through the host secret manager or ignored environment file before executing:

```sh
docker compose config --quiet
docker compose build --pull
docker compose up -d --wait
```

| Setting | Purpose |
| --- | --- |
| `MATRIX_PG_PASSWORD`, `MATRIX_RUNNER_TOKEN` | Independent random credentials. Use at least 32 characters for the runner token. |
| `S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` | A pre-created private bucket reachable by API and worker. Limit the service account to that bucket. |
| `CLAMD_HOST`, `CLAMD_PORT` | Private scanner reachable by the worker. Scan failures block extraction. |
| `MATRIX_HOSTS`, `MATRIX_PUBLIC_ORIGIN` | Allowed hosts and the exact external scheme, host and port. Terminate TLS before forwarding to the loopback frontend. Include localhost for internal health probes. |
| `MATRIX_REVIEW_MODEL`, `MATRIX_REVIEW_KEY` | Optional Gemini model and freshly issued key. Local evidence rules require neither. |
| `MATRIX_INPUT_USD_PER_M`, `MATRIX_OUTPUT_USD_PER_M` | Optional current model prices per million tokens used to estimate evaluation cost. |

The Terraform/cloud account, certificate, external bucket, malware daemon and release promotion are operator-owned. Compose starts no public endpoint by itself. Code-runner tests use a digest-checked CPython image. The Linux application dependency lock includes wheel hashes. Refresh and review OS image tags and digests before promotion.

## SQLite to PostgreSQL

Keep the local database for the local edition. A controlled cutover uses a separate empty PostgreSQL schema and the same application release.

1. Quiesce writes and drain grading, upload and extraction jobs. Take private backups of SQLite and object storage. Keep authentication credentials and private backups out of Git.
2. Copy source documents to the private destination bucket using their original keys. Verify object counts and SHA-256 checksums. Resume metadata alone cannot restore the document bytes.
3. Upgrade a private copy of the SQLite snapshot to this release. Set the backend process `DATABASE_URL` to a **new empty PostgreSQL schema** and run `python -m scripts.import_sqlite /path/to/snapshot.sqlite3` from the repository root. The importer opens SQLite read-only, checks foreign keys, copies in dependency order, reconciles counts and commits the destination atomically. Existing target tables cause it to stop.
4. Sessions, rate-limit buckets, worker pulses, active grading leases and broker messages are transient. Users sign in again. Exercise tenant isolation, a stored assessment, the private original document and a reviewed scorecard before switching traffic. Keep the old application quiescent for rollback. If writes have occurred on the new target, reconcile them before routing users back.

## Security and release gates

| Surface | Verification or remaining gate |
| --- | --- |
| Accounts, roles and tenant isolation | Salted password hashes, expiring hashed sessions, scoped application/document/result access, invite expiry and digest storage. Tests use two organizations and candidate identities. Internet exposure still requires verified identity and controlled enrollment. |
| Assessment and execution | Ordered immutable versions, server keys and time limits, duplicate protection and real WASI execution. The checked-in bank is public. Use confidential banks and an independently maintained execution host for consequential assessments. |
| Uploads, deletion and retention | Size/type bounds, private object keys, scanner gate, checksum checks, bounded extraction, authorized original downloads, scheduled expiry and dependent evaluation deletion. Production backup erasure and disaster-recovery exercises remain operational responsibilities. |
| Prompt injection, CSRF and rendering | Allowlisted structured findings, server-side evidence verification, fixed Gemini destination, same-origin mutation checks, Strict session cookies, escaped React text and Nginx CSP. Automated limiters cover authentication and evaluation calls. Shared-service quotas and edge abuse protection remain necessary for internet traffic. |
| Git and credentials | The verified destination is the owner’s canonical GitHub repository. Staged-snapshot scanning checks known secret and PII patterns. Reachable Git history includes the former backend environment file. Removal from the current tree does not establish provider revocation. Rotate historically exposed credentials, inspect provider activity, and coordinate any separately approved history cleanup with clone and fork owners. |
| AI and human review | No automated hiring transitions, candidate ranking or model-only decision. Human agreement has no labelled baseline. Gemini quality and costs need a consented trial on the configured model. |
| Browser and containers | Chromium automation ran with synthetic audio. Test physical devices, additional browsers and the final HTTPS origin. Require green hosted image/service checks and a scanner/object-store rehearsal in the actual target environment before public access. |

The GitHub workflow performs scoped static checks, backend tests on SQLite and PostgreSQL, schema generation, secret and dependency scans, frontend tests, browser tests and builds. A separate job builds and exercises Compose services with temporary CI credentials. No workflow deploys a release.

See the [evaluation and readiness architecture](architecture/evaluation-and-readiness.md) for scoring and privacy boundaries, and the [historical security assessment](security/security-assessment.md) for incident response.

## Verification record for the November 26, 2026 demo

| Check | Local result |
| --- | --- |
| Backend and API | 30 tests passed on SQLite. The PostgreSQL-only import case was skipped. The original 28 tests passed using a disposable PostgreSQL instance, including the migration and overwrite-refusal test. |
| Evaluation quality | Golden schema and arithmetic cases passed. All seven deliberately invalid model responses were rejected. A provider failure produced zero additional scorecards. The human-agreement metric is unavailable without independent labels. |
| Frontend | Twelve component and audio-controller tests passed. Six Chromium browser tests passed on Monaco typing, indentation, undo/redo, paste, resizing, draft recovery, code discussions with editable dictation and local audio playback. Speech recognition events were simulated for repeatability. |
| Integrated demo | The rehearsal used real private S3-compatible storage, the OS scanner, Celery, the parser, the assigned assessment and a human-reviewed scorecard. Original document deletion completed. |
| Build and dependency checks | Vite production build and ESLint passed. npm audit and pip-audit reported no known advisories in the checked frontend tree and backend dependency resolution. Monaco remains a large lazy-loaded bundle. |
| Repository | Six repository-safeguard tests passed. Historical inspection found one reachable environment blob matching a provider credential signature. Credential rotation must be confirmed with the provider. |
| Deployment | The seven-service Compose file validated against the Compose specification. Local verification used native processes. Check the GitHub Actions run for the pushed commit for the Linux container result. |

The [code follow-up walkthrough](../README.md#demo-a-code-follow-up) uses the local question generator for a key-free presentation. For a Gemini presentation, configure a fresh provider key and rehearse with the intended microphone and browser.

A passing fixture does not measure a model’s performance on real hiring data. The release needs human review of real-world rubric relevance, privacy policy and operating controls before consequential use.
