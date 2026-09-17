# DealerFlow Pilot-Readiness Reconciliation

**Assessment date:** September 7, 2026  
**Decision:** NO-GO for a real dealership pilot  
**P0:** 0 verified  
**Release baseline:** `4912c7694da64a227edb4d4efe0247651b0f00f4`

## Immutable baseline

The isolated-staging golden journey is accepted evidence and must not be reopened without contradictory evidence. Better Auth login, tenant and rooftop authorization, Salesperson and General Manager separation, Lead-to-Deal continuity, immutable Quote versions, self-approval denial, Manager approval, customer-safe exact-version acceptance, contracting, required-document readiness, delivery handoff, and final `delivered` status all passed against the isolated demo tenant.

The following older blockers are closed or no longer pilot blockers:

- Isolated Render staging and database identity are proved.
- Required migrations through the golden-journey release are applied to isolated staging.
- A usable synthetic Salesperson and General Manager exist through Better Auth.
- Manager organization membership, rooftop authorization, and canonical capabilities are reconciled.
- The Quote, Desking, contracting, document-readiness, and delivery journey is complete.
- Synthetic reset-harness maintenance permission is not a real-dealership launch dependency. It remains test-environment maintenance work and may not block a pilot.
- AI, Slack, billing, e-signature, lender submission, DMS posting, autonomous sends, and autonomous pricing are not required when excluded from the approved pilot scope.
- R2 media is conditional: it is P1 only if DealerFlow-hosted inventory media is included in the first pilot.

## Current P0/P1 list

No verified P0 security, isolation, authentication, authorization, data-integrity, or core-workflow defect is open.

| ID | Priority | Gate | Evidence missing for a real pilot | Closure condition |
| --- | --- | --- | --- | --- |
| PILOT-P1-01 | P1 — EMAIL PASSED / SMS PAUSED | Communications | The restricted Resend path is accepted; eight historical non-allowlisted messages remain blocked exactly as designed. Twilio configuration is ready, but the sender remains behind the external A2P/provider enablement gate. See [restricted staging acceptance](STAGING_COMMUNICATIONS_ACCEPTANCE_2026-09-07.md). | Preserve the accepted email path. After Twilio enables the sender, pass live SMS outbound, inbound, status, failure, retry, STOP/consent, duplicate, outage, timeline, authorization, privacy, and responsive acceptance. |
| PILOT-P1-02 | PASSED | Vehicle intelligence and inventory scope | The governed catalog projection, atomic publication/replay/rollback, controlled Vehicle matching, tenant/role denial, responsive role acceptance, and both protected simulation regressions passed in isolated staging. See [Vehicle Intelligence bridge](VEHICLE_INTELLIGENCE_BRIDGE_2026-09-08.md). | Reopen only for a new objective P0/P1 regression. |
| PILOT-P1-03 | P1 — PARTIAL | Recovery, monitoring, and support | Durable email recovery, bounded retry/terminal failure, release smoke checks, live telemetry, and one external signed Slack-compatible alert receipt are proved. A disposable-database restore, measured recovery timing, named acknowledgement/escalation coverage, and the remaining failure drills are not complete. | Restore representative tenant data into approved isolation; verify application recovery; exercise database, job, application, and provider failures; record recovery timing, escalation, rollback, and named coverage. |
| PILOT-P1-04 | P1 — ACTIVE | Dealership onboarding and data migration | The governed provisioner created the clean-room demo Organization, rooftop, configuration, 11 canonical roles, capability grants, initial Owner invitation, and bilateral denial from the existing tenant without hand-editing PostgreSQL. The Owner invitation expired before acceptance, leaving zero memberships; the provisioner now has a locally validated, audited deterministic rotation repair. First login, onboarding smoke, governed imports, replay/conflict evidence, and reverse-direction denial remain open. | Deploy the reviewed invitation-recovery repair, rotate the exact expired Owner invitation, complete Better Auth setup, then finish role/location verification, onboarding/import smoke, replay/conflict checks, and reverse-direction tenant denial. |
| PILOT-P1-05 | P1 — PARTIAL | Human role UAT and pilot decision | Salesperson and Manager separation of duties and responsive workflow evidence passed through the protected simulations. A named pilot dealership/cohort, launch owner, rollback owner, support owner, dealership champion, success criteria, complete Sales Manager/General Manager/F&I human UAT, dealer sign-off, and explicit GO decision remain open. | Name and authorize the cohort and owners; complete the remaining role-based desktop/mobile UAT on the exact release; disposition findings; record dealer sign-off and an explicit GO decision. |

## Conditional scope gates

These items become P1 only when included in the signed first-pilot scope:

- DealerFlow-hosted inventory media now has accepted isolated-staging object storage, exact-origin CORS, browser upload, server verification, primary rendering, and cross-system object/database evidence. Governed removal reconciliation and outage behavior remain before production use; the public R2 development URL is staging-only.
- Durable document binaries and e-signature require accepted storage, retention, access, signature-provider, and recovery evidence. Existing dealer systems may remain authoritative if this is explicit in scope and operating procedures.
- Provider-backed AI requires tenant configuration, privacy approval, grounded-output evaluation, failure behavior, and a deterministic non-AI workflow. AI is otherwise disabled and non-blocking.

## Sequence

1. Communications/provider acceptance.
2. Vehicle Intelligence bridge or explicit reduced-scope decision.
3. Recovery, monitoring, alerting, and support drills.
4. Fresh-dealership onboarding/import rehearsal.
5. Human role UAT and explicit pilot GO decision.

No production deployment, real customer communication, real dealer import, or pilot GO is authorized by this reconciliation.
