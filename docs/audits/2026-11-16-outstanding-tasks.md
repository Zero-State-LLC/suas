# Outstanding audit coordination — 2026-11-16

Project: existing SUAS Product Board (scrimshawlife-ctrl project 6); access BLOCKED by integration permissions. Organization Issues are also disabled; issue creation failed, and no settings were changed. Owner for all tasks: unassigned pending project access; no assignment implied.

## Native request payloads do not match the current API

- Priority: P1
- Repository: suas-ios / suas-android
- Owner: unassigned
- Status: Blocked
- Blocker: Native builds pin0.6 and lack current onboarding/forms; coordinated adoption required
- Next action: Choose supported native/server contract and implement payload fixtures before shared staging
- Related branch: bugfix_audit_authorization
- Evidence: native-review.md

## Release and expiry notifications can be lost after state commits

- Priority: P2
- Repository: Zero-State-LLC/suas
- Owner: unassigned
- Status: Open
- Blocker: Non-atomic state/notice writes; no durable retry intent
- Next action: Persist notification intent atomically; add fail-once retry test; inspect source PR258 before backport
- Related branch: bugfix_audit_authorization
- Evidence: spec-review.md

## Dependency advisory exposure assessment

- Priority: P1-triage
- Repository: Zero-State-LLC/suas
- Owner: unassigned
- Status: Open
- Blocker: Root scan reports7 high and9 moderate affected packages; exploitability not established
- Next action: Review reachability and patch within compatible versions; separately qualify Zod major migration
- Related branch: bugfix_audit_authorization
- Evidence: root-dependency-audit.json

## Repository migration and release history reconciliation

- Priority: P2
- Repository: suas / suas-specs
- Owner: unassigned
- Status: Blocked
- Blocker: Org copies lack tags/releases/runs and trail source; board permission denied
- Next action: Owner reconciles authoritative migration baseline and project access; preserve existing histories
- Related branch: bugfix_audit_authorization
- Evidence: pr-inventory.json

## Complete per-contribution audit and staging qualification

- Priority: P2
- Repository: All SUAS repositories
- Owner: unassigned
- Status: Open
- Blocker: 113 source PR records inventoried; not individually reviewed; staging not qualified
- Next action: Review remaining changes and reviews, then qualify exact staging identity after code gates
- Related branch: bugfix_audit_authorization
- Evidence: pr-inventory.json
