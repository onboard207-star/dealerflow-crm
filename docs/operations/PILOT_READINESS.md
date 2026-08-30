# DealerFlow Pilot Readiness Evidence

## Decision

**NOT PILOT READY — operational evidence blockers remain.**

This is not a verified P0 application defect. The current release has strong tenant, role, location, provider, and data-integrity controls, but the pilot gate requires evidence that does not yet exist: a completed backup restore exercise, configured production-capable monitoring and alert ownership, pilot support ownership, controlled pilot import rehearsal, and provider failure acceptance with pilot credentials.

## Release under review

- Branch: `codex/staging-deployment`
- Baseline commit: `985d040d09538a6dd95792b95e2708763c0a6aa6`
- Hardening implementation commit: `85471fa60b0cbdf4e54798cb51642553339cd167`
- Runtime: Node.js 24.19.0 in the local validation environment
- Framework: Next.js 15.5.21, React 19.1.0, TypeScript 5.7.2
- Database: PostgreSQL with forced tenant RLS; checked-in migrations `0000` through `0035`
- Intended first-pilot scope: Sales, BDC, Sales Management, Inventory, and Vehicle Workspace
- Explicitly excluded until independently accepted: Finance, Recon, Service, cross-tenant Platform Administration, billing, and destructive tenant offboarding

## Gate status

| Gate | Status | Evidence or blocker |
| --- | --- | --- |
| Tenant isolation | Verified in repository | Forced RLS, composite tenant foreign keys, tenant transaction context, adversarial tenant and rooftop authorization matrix |
| Authorization | Verified in repository | Deny-by-default capabilities, active membership requirement, direct API authorization, disabled-module filtering |
| Authentication | In progress | Secure staging/production cookies, verified email, invitation-only signup, session revocation after reset; formal lockout/load testing remains |
| Secrets | Verified for tracked source | Credential-pattern scan found only explicit fake test URLs; deployment-secret values were not copied or exposed |
| Core workflow | Verified on staging for prior release | Lead-to-sale and returning-customer paths completed; exact hardening release requires smoke acceptance after deployment |
| Provider behavior | Blocked | Email has staging evidence; AI, media, Slack, billing, and pilot SMS failure exercises are incomplete or unconfigured |
| Monitoring and alerts | Blocked | Structured telemetry and signed alert webhook exist; no verified external receiver, on-call owner, or alert drill |
| Backup | Blocked | Hosting capability is documented, but an actual backup timestamp and retention inspection are not recorded |
| Restore | Blocked | No isolated restore exercise with measured duration and record validation is recorded |
| Mobile and accessibility | In progress | Prior 320–430 px acceptance exists; hardening-release browser matrix remains to be rerun |
| Pilot data import | Blocked | Deterministic demo template is not a controlled real-customer import with preview, validation, error report, and abort |
| Support readiness | Blocked | Severity definitions are documented below, but named pilot owners and communication channels require founder approval |

## P0 security findings

No verified P0 was found in the checked-in release. The following remain hard rules:

- There is no production or tenant-facing demo-reset endpoint.
- Platform administrators do not receive implicit cross-tenant access; tenant membership remains required.
- Provider secrets are server-only references and are excluded from telemetry and API payloads.
- Webhooks require provider signature validation and durable tenant integration mapping.
- AI output cannot directly execute SQL, permissions, billing changes, Deal approval, or arbitrary actions.

Any violation of these rules changes the verdict to immediate NO-GO.

## Recovery targets

Initial internal planning targets, not contractual commitments:

- Target RPO: 24 hours until verified point-in-time recovery is enabled and measured.
- Target RTO: 8 hours until a restore drill establishes a better measured result.
- Application rollback: redeploy the last known-good immutable commit only after checking schema compatibility.
- Database recovery: use a verified backup or reviewed forward repair; never blindly reverse a destructive migration.

## Required evidence before GO

1. Record the Render PostgreSQL backup/PITR configuration, retention, latest successful backup, and responsible owner.
2. Restore that backup into an isolated non-production database and validate representative Customers, Leads, Deals, Inventory, communications, memberships, and tenant isolation.
3. Configure an external telemetry/alert receiver and run application, database, worker-stall, and provider-failure drills.
4. Run the deployment smoke suite and authenticated first-pilot story against the exact release SHA.
5. Rehearse a validated pilot import with preview, duplicate disposition, errors, and abort semantics.
6. Name the pilot sponsor, dealership champion, support owner, escalation contact, dates, and success criteria.
7. Obtain an explicit production release approval; staging success never authorizes production deployment.

## Staging verification — August 30, 2026

Render deployed hardening commit `85471fa60b0cbdf4e54798cb51642553339cd167` successfully. Authenticated tenant administration rendered the expected organization-scoped readiness view and exposed the bounded release identity (`staging`, commit `85471fa60b0c`) without secrets or production authorization.

The read-only deployment smoke suite passed liveness and the release identity contract, then stopped at readiness with HTTP 503. The readiness payload reported `database: ready` and `runtime-configuration: unavailable`. This is a truthful release blocker, not a reason to weaken the readiness check. Protected-worker and later smoke assertions did not run after the fail-fast readiness result.

## Severity and response ownership

- P0: tenant exposure, destructive unauthorized action, credential exposure, or broad outage. Stop affected workflows, page the technical owner, preserve evidence, and notify the pilot sponsor.
- P1: core pilot workflow unavailable or data integrity at risk. Same-business-day owner and workaround required.
- P2: degraded non-core workflow with a safe workaround. Track and schedule.
- P3: cosmetic, documentation, or low-impact usability issue. Prioritize normally.

Names, phone numbers, response-time promises, and customer communication channels require founder approval and must not be invented in source control.
