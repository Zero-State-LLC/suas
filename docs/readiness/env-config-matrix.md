# Environment / configuration matrix

Pin source: `src/release/pins.ts`. Living values must match that file.

| Variable                           | LOCAL                                       | TEST            | STAGING                                        | PRODUCTION                               |
| ---------------------------------- | ------------------------------------------- | --------------- | ---------------------------------------------- | ---------------------------------------- |
| `SUAS_ENV`                         | required                                    | required        | required                                       | rejected until SPEC-018 authorizes       |
| `SUAS_SPEC_VERSION`                | `0.10.0`                                    | `0.10.0`        | `0.10.0`                                       | `0.10.0` when authorized                 |
| `SUAS_RELEASE_MANIFEST`            | `RELEASE_MANIFEST-0.10.0.md`                | same            | same                                           | same when authorized                     |
| `SUAS_ALLOW_REAL_EXTERNAL_EFFECTS` | false                                       | false           | false                                          | only if release authorizes               |
| `SUAS_JOB_QUEUE`                   | in-memory fake (default) or postgres-outbox | same            | ignored: Postgres outbox (D-022 pending)       | ignored: Postgres outbox (D-022 pending) |
| `DATABASE_QUERY_TIMEOUT_MS`        | optional, default 20000                     | same            | same                                           | same                                     |
| `SUAS_SUPPORT_SIGNAL_MODE`         | fixture/disabled                            | fixture         | fixture or released                            | released only                            |
| `SUAS_SAFETY_COPY_MODE`            | placeholder                                 | placeholder     | approved when reviewed                         | approved                                 |
| Migrations                         | apply/validate                              | apply in CI     | explicit apply in runbook                      | explicit; never implied                  |
| Session secret                     | required when auth on                       | generated in CI | secret store                                   | secret store                             |
| `SUAS_EMAIL_MODE`                  | sink/fake                                   | fake            | `resend` (suas #305)                           | rejected until SPEC-018 authorizes       |
| `RESEND_API_KEY`                   | unused                                      | unused          | relay secret only (never API/worker env)       | n/a                                      |
| `SUAS_EMAIL_FROM`                  | unused                                      | unused          | relay env, from SSM `/suas/staging/email-from` | n/a                                      |
| `SUAS_EMAIL_RELAY_FUNCTION`        | unused                                      | unused          | the relay function name (CDK)                  | n/a                                      |

`SUAS_JOB_QUEUE` accepts only `in-memory-fake` or `postgres-outbox`; any other value fails startup (ENVIRONMENT.md §5). `DATABASE_QUERY_TIMEOUT_MS` must be a positive integer; it is a client-side mechanism bound (ARCHITECTURE.md §13), not an SLO.

Email (owner issue suas #305; D-004 Resend): LOCAL and TEST reject `resend`. On AWS STAGING the
API and job worker set `SUAS_EMAIL_MODE=resend` and only `SUAS_EMAIL_RELAY_FUNCTION`; the relay
function outside the VPC reads `RESEND_API_KEY` from its Secrets Manager secret and has
`SUAS_EMAIL_FROM` in its environment. STAGING refuses `resend` without the relay variable (no
direct send from the VPC). Every send checks the STAGING recipient allowlist first. There is no
other EMAIL provider mode.

Source of truth: `src/config/schema.ts` + ENVIRONMENT.md + `src/release/pins.ts`.
