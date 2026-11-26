# InterviewMatrix

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Candidates and recruiters are equal primary users. A candidate under a deadline needs to understand the task, keep their work and submit with confidence. A recruiter reviewing an application needs to verify what a score measures, inspect the underlying evidence and own the decision. When these needs compete, protect both the integrity of the timed attempt and the recruiter's ability to verify the result.

## Product Purpose

Give candidates a place to practise aptitude and Python, and give hiring teams a way to review work against a specific role. A successful practice session ends with a result the candidate can learn from. A successful hiring review ends with a human decision whose supporting evidence and reasoning another authorized reviewer can follow.

## Positioning

InterviewMatrix connects three records that answer different questions. An execution result shows which tests the submitted code passed. A resume fact points back to the passage that supports it. A versioned job rubric explains how the recruiter evaluated that evidence. Candidates can discuss a coding choice in their own words while the execution record remains the authority on correctness.

## Operating Context

- Candidates sign in with email and password. In the practice library they choose a company collection, track and level. They can also claim a private invitation to a recruiter-assigned assessment. Personal practice stays private to its owner.
- During an attempt, candidates work against a server deadline, save drafts and recover saved work after interruption. Python submissions run against versioned test cases in an isolated environment. After grading, candidates can revisit results and discuss their code.
- Recruiters publish job criteria, invite candidates and track applications within their organization. During review they inspect resume excerpts and assessment results, accept or override individual findings and record a disposition with an audit trail.
- The local presentation uses project-local SQLite, synthetic accounts and fictional resumes. Company-labelled practice collections are public learning material. The demonstration uses no employer endorsement or measured hiring-outcome claims.

## Capabilities and Constraints

- Preserve the assessment and job versions used by an existing attempt or application. The server owns timing, scoring and authorization.
- Keep test correctness, optional AI coaching, evaluation confidence and human judgment distinct. Show missing evidence explicitly. Every review override records the original value, revised value, reviewer, time and reason.
- Scope application records and documents to the authorized candidate and organization. Obtain consent for optional external AI processing. The microphone preflight uses local recording and playback. Dictation can use the browser's speech service and starts only when requested.
- Practice timing and difficulty are editorial choices. Any future claim about hiring validity requires calibration data.

## Brand Commitments

Use the name **InterviewMatrix**. Write in the language of the task. A candidate should see what they are submitting, how much time remains and whether their work was saved. A recruiter should see the criterion, its evidence and the decision they are recording. Keep explanatory copy where it helps someone act, recover or give informed consent.

## Evidence on Hand

- The versioned practice bank contains aptitude questions and Python problems, including reference test cases for the advanced capstones. [Aptitude collections](data/aptitude/) · [Python collections](data/coding/)
- The local rehearsal exercises private upload, extraction, assessment, citations and human review using synthetic records. [Rehearsal](scripts/verify_live.py) · [Release walkthrough](docs/release.md)
- Published regression checks cover scoring, tenant boundaries, code discussions, editor behavior and microphone readiness. [Backend tests](tests/) · [Browser tests](frontend/my-react-app/e2e/)

## Product Principles

1. Protect the candidate's time. Make the deadline, save state, submission state and recovery path clear.
2. Let the reviewer inspect the source. Keep the relevant evidence within reach of each finding.
3. Give people control over consequential actions. Candidates choose what to share, and recruiters take responsibility for decisions.
4. Show what actually happened. Use stored results for activity and stage counts, and represent empty, pending and failed states honestly.

## Accessibility & Inclusion

Support keyboard use throughout timed assessments. Python indentation, undo and draft recovery help candidates stay focused on solving the problem. Offer typing alongside optional speech input so microphone permissions, hardware and browser support never determine whether someone can answer a follow-up. Keep a confirmed explanation private until the candidate shares it for a completed assignment. Keep coaching feedback separate from the test verdicts. Communicate status in text, respect reduced motion and make chart values available by keyboard.
