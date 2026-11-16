# Engineering audit — 2026-11-16

## Executive summary

Partial audit and remediation; synthetic staging is **not qualified**. Production readiness remains NOT_READY, SPEC_018_PRODUCTION_AUTHORIZED=false, real effects disabled, pilot and production blocked. No production deployment, real Veteran data, or gated D-007 execution occurred.

VERIFIED means observed source/API/execution evidence; INFERRED means reasoned but not directly observed; BLOCKED names an access or authority prerequisite; NOT CHECKED means no conclusion.

## Repository and release identity

| Repository                      | Default branch / inspected commit               | Evidence                                                        |
| ------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Zero-State-LLC/suas             | main / 35d2cc42205308e42b27da634612d58b3139cd67 | GitHub id1452020479; admin/push/pull reported; main unprotected |
| Zero-State-LLC/suas-specs       | main / 208705cfd2b6aa1ce913ac9e70a2d42a1c9487ad | id1452017688; admin/push/pull reported; no tags/releases        |
| scrimshawlife-ctrl/suas-ios     | main / f6eccc98073b1100c9f771eba5e776e4bbe576b2 | id1350995123; admin/push/pull reported                          |
| scrimshawlife-ctrl/suas-android | main / 5bf2ba3aad99970e90326f2f59bd044bb31ce301 | id1350993981; admin/push/pull reported                          |

VERIFIED: latest released specification on the documented source repository is [v0.10.0](https://github.com/scrimshawlife-ctrl/suas-specs/releases/tag/v0.10.0), published November14, tag commit 6cd437e61b11f67e04b2bd91101d33f7c09c0fce. Source main is f71479ae5e4c83be423ae88e0a05c2f341effdc6. Application remains pinned0.9.0, whose source release tag resolves to208705c. No automatic re-pin:0.10 contains incompatible request-gate changes and requires native assessment.

INFERRED: incomplete repository migration explains the absent history in organization copies. VERIFIED: source and organization repositories have different GitHub IDs, and source has later work. Owner reconciliation of the intended migration baseline is required before importing absent work.

## Audit findings

| Priority | Finding / evidence                                                                                                             | Root cause and disposition                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Former helper can START after another helper accepts; `src/http/routes/service-requests.ts` and `src/coordination/requests.ts` | Authorization preceded row lock. Fixed: route passes server-derived requiredHolderUserId, checked under lock; RELEASE still checks actor unconditionally. Controlled real-domain-function regression failed before correction and passes afterward. Actual concurrent HTTP reproduction NOT CHECKED.                                                                                                                                                      |
| P1       | SES accepted in STAGING, infra selected it and granted SendEmail; `src/config/schema.ts`, `infra/lib/backend-stack.ts`         | Proposal treated as delivery authority, contrary to ENVIRONMENT §3 and manifest0.8 explicit prohibition. Fixed: reject SES in all environments, sink infrastructure defaults, remove SES send grants. Dormant adapter/DNS identity retained.                                                                                                                                                                                                              |
| P1       | Native request payloads rejected by current server                                                                             | iOS `AppState.swift:130` sends location/object destination; Android `ConnectedRequestScreen.kt:192` sends pickup_label/destination_label/note. Strict server details accepts bounded summary/timing/meeting_place/string destination. Executed actual Zod parser with matching synthetic native payloads; rejected. Both clients still pin0.6. Coordinated contract/form/onboarding adoption required; no superficial pin bump or untested native repair. |
| P2       | Required release/expiry notice may be permanently lost                                                                         | `src/coordination/expiry.ts:174` and `src/http/routes/service-requests.ts` enqueue after state commits; subsequent sweeps/replays skip work. Source-level failure path VERIFIED; fail-once integration reproduction NOT CHECKED. Track atomic durable intent/retry; upstream PR258 needs selective review before backport.                                                                                                                                |
| P2       | Stage/release instructions contradictory                                                                                       | Fixed current AGENTS/CONTEXT/FABLE: runtime SPEC-017 boundary distinct from prior0.6 evidence, current0.9 qualification, blocked SPEC-018 launch qualification and production authorization. Historical evidence untouched.                                                                                                                                                                                                                               |
| P3       | publicSignUp configuration name implies control it does not provide                                                            | `src/auth/staging-access.ts:42` deliberately ignores it in LOCAL/TEST. Clarity concern, not proven authorization bypass. Outstanding.                                                                                                                                                                                                                                                                                                                     |

No P0 finding confirmed. Dependency severity is not an application exploitability claim: registry audit reports root7 high/9 moderate affected packages, web7 moderate, infra2 moderate. Root includes Fastify/fast-uri and Zod advisories. No critical advisory reported. Reachability and compatible upgrades remain open; Zod fix suggestion crosses a major version. Raw registry records retained locally.

## Additional provider finding

P1 VERIFIED and repaired: the STAGING Resend registry previously sent operational alerts/follow-ups despite ENVIRONMENT §3 restricting it to authentication-delivery evidence. A mocked-fetch reproduction showed transport called for alert@1,followup@1 and an unreleased auth template. `src/notifications/channels.ts` now selects authentication-only delivery in STAGING; `resend-email.ts` refuses every template except auth.email_otp and auth.magic_link before transport. Five regression cases and70 targeted tests passed. No real external calls were used.

## Contributor review

VERIFIED GitHub attribution for250 recent commits: Badri-Rajendran140, scrimshawlife-ctrl99, cursoragent11. GitHub maps both Badri’s noreply identity and BADRI NARAYANAN’s commit email to user79736071; e.g.823fc7e and6425bb3. No timing or unrelated co-author inference used.

113 recent source PR records inventoried;36 merge SHAs are ancestors of target head and77 are absent. Reviews/file lists retrieved separately. Inventory is not blanket acceptance. All36 target PRs individually triaged (35 partial,one single-file document reviewed); selected request/chat/auth/config/contacts/check-in/migration paths reviewed; complete per-PR and changed-file review remains incomplete. Existing approvals were not treated as correctness evidence. Accepted behavior has bounded test evidence; corrected work is described above; outstanding concerns include native contracts and durable notices.

## Engineering changes

Branch: `bugfix_audit_authorization`.

- b9d4d75: helper authorization under row lock; new regression tests.
- e65c1ba: SES fail-closed configuration/infrastructure and tests/docs.
- 58c10ed: stage/release documentation and changelog.
- Final audit evidence/lint cleanup recorded in subsequent commit.

No public API schema or database migration change. No spec pin change. Rollback is a reviewed code revert; reverting security corrections reopens the findings and is not recommended. No merge/tag/deployment performed.

6c02bd5 adds the STAGING Resend purpose restriction and its five registry-level regressions. Three operational/unreleased-template cases failed before correction; valid OTP and magic-link cases remain supported. The new guard changes STAGING only; LOCAL browser evidence remains applicable to its unchanged fake EMAIL mode.

## Qualification

See final command results below. All runtime tests use TEST or LOCAL, fake adapters, fixture scoring and placeholder_test_only safety mode. PostgreSQL17 runs in an isolated local container with disposable synthetic databases. Browser suite uses its guarded suas_local_e2e database.

Initial sandbox attempts failed on local socket/process permissions; test dependencies were then installed and execution repeated with permitted local access. Initial formatting failures came from locally installed skill files; those were moved outside the application tree and linked, without changing tests. First holder fix exposed legacy internal USER callers; fixed using an explicit server-owned constraint instead of weakening those tests. A stale in-flight suite saw mixed edits; its10 failures are not final qualification evidence. Final lint found an unused SES import, removed before rerun.

VERIFIED historical CI for the exact baseline: [verify](https://github.com/scrimshawlife-ctrl/suas/actions/runs/42906461702), including successful verify and web-e2e jobs. Organization repository returns zero runs and13 active workflow definitions. Actions permission inspection returns403; therefore account-level enablement is BLOCKED, not inferred disabled. New branch CI remains separate from baseline evidence.

Native checks: both route-pin scripts pass, iOS project99 checks and bundle-checker17 tests pass; Android forbidden-capability scan passes. These route checks miss payload incompatibility. Native builds/device validation BLOCKED: no Swift/Xcode, Android requires Java25 versus installed21 and SDK/toolchain unavailable. Native newer edit/release/chat/check-in/contact features are adoption backlog; missing Text838255 becomes a violation upon0.8+ adoption, not of existing0.6 pins.

## Release readiness and continuation

Completed: repository identity/discovery, source release reconciliation, three reproduced security repairs with regression coverage, local qualification work, bounded native contract assessment, independent review, fail-closed evidence preflight.

BLOCKED: Project6 access rejected by integration; organization Issues disabled, so attempted issue creation failed. No settings changed. Local coordination register preserves priority, repository, owner(unassigned), status, blocker, next action, branch and evidence.

Owner decisions: reconcile migration baseline and intended supported native/server release; restore project/issue access; supply independently verified synthetic deployment identity and authorized configuration for later staging acceptance. Existing launch controls remain mandatory. No need for owner approval to continue ordinary local audit and regression work.

Next executable milestone: finish per-contribution review and dependency exposure triage, make durable lifecycle notices retryable, then qualify coordinated native contracts and the exact synthetic staging deployment. Staging identity, deployed variables, migration preflight, observability, rollback drills and acceptance are NOT CHECKED. Definition of done is not met. A stalled browser logout is also a P2 candidate requiring a mocked-network reproduction; static source shows no timeout before clearing local session state, but this is not yet classified as a verified defect.

Local evidence directory: `/workspace/audit-evidence/` (command logs, attribution, PR/review/file inventory, independent reports, dependency scans, coordination register). These raw artifacts are workspace-local; this committed summary is the durable handoff. No raw test credentials or browser traces are published.

## Recorded command results

| Directory          | Command                                                                                                              | Exit        | Result                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| root / web / infra | `npm ci`                                                                                                             | 0 each      | Locked installs                                                                          |
| root               | `npm run verify`                                                                                                     | 0           | 135 files,1788 tests passed; includes format,lint,typecheck,staging contract and OpenAPI |
| root               | `npm run build`                                                                                                      | 0           | TypeScript build                                                                         |
| web                | `npm run check`                                                                                                      | 0           | 73 files,558 tests passed; lint,typecheck,build passed                                   |
| infra              | `npm run check`                                                                                                      | 0           | 3 files,31 tests passed; typecheck and offline synth passed                              |
| web                | `SUAS_E2E_SAFETY_COPY_MODE=placeholder_test_only npm run test:e2e`                                                   | 0 first run | 19 passed in each of two runs; final run3.5min                                           |
| root               | `npm run evidence:preflight`                                                                                         | 0           | Committed synthetic configuration only; all launch/effect controls closed                |
| root               | `UV_CACHE_DIR=/tmp/suas-uv-cache uv run --no-project python scripts/validate-skills.py`                              | 0           | Six runtime skills valid                                                                 |
| root               | `UV_CACHE_DIR=/tmp/suas-uv-cache uv run --no-project python -m unittest discover -s tests -p test_skill_metadata.py` | 0           | Three tests passed                                                                       |
| root / web / infra | `npm audit --json`                                                                                                   | 1 each      | Advisories recorded above; no automatic force upgrades                                   |

Standalone initial format/lint/typecheck/build/test/OpenAPI attempts are preserved in qualification.json. Local socket/process sandbox failures were resolved with permitted execution. Final verify executes the same required scripts successfully. Initial unit-only sandbox run:964 passed,3 process-permission failures; final full suite supersedes that result.

Staging availability: read-only `curl --fail --silent --show-error --max-time 20 https://suasqrf.com/api/v0/health` returned exit0 and status ok, database configured, durable postgres-outbox configured. Health does not prove runtime identity or data class. Latest observed source worker-deploy success is [run41569253929](https://github.com/scrimshawlife-ctrl/suas/actions/runs/41569253929), commit8830b0a, November3. This is historical deployment evidence, not proof of the current deployment. No authenticated staging acceptance was attempted.

## Supporting records

- [Native compatibility](2026-11-16-native-compatibility.md)
- [Per-PR coverage and limits](2026-11-16-contributor-coverage.md)
- [Outstanding task register](2026-11-16-outstanding-tasks.md)

Final root verification after6c02bd5: `npm run verify` exit0,135 test files and1788 tests passed,76 OpenAPI routes matched. Final infrastructure check exit0 (31 tests and synthesis). Report hygiene check separately covers the evidence documents. No final test failures remain in these executed suites. Registry advisory findings and unexecuted release gates remain open.
