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
| PILOT-P1-02 | P1 — ACTIVE | Vehicle intelligence and inventory scope | Source structure and the minimum PostgreSQL projection are now inventoried, and migration `0054` plus deterministic-ID validation establish the local runtime foundation. Full source extraction/reconciliation, governed projector execution, isolated-staging migration, rollback evidence, and runtime acceptance remain incomplete. See [Vehicle Intelligence bridge](VEHICLE_INTELLIGENCE_BRIDGE_2026-09-08.md). | Complete source QA and a versioned DealerFlow-ID projection with provenance, reconciliation, failure handling, and no Airtable record IDs in runtime authority; prove controlled Vehicle matches without mutating physical Inventory authority. |
| PILOT-P1-03 | P1 | Recovery, monitoring, and support | No successful isolated backup restore, measured recovery evidence, external alert receipt, job-recovery/provider-degradation drill, or named monitored support ownership. | Restore representative tenant data into isolation; verify application recovery; exercise database, job, application, and provider failures; record alert receipt, escalation, rollback, and named coverage. |
| PILOT-P1-04 | P1 | Dealership onboarding and data migration | No clean-room rehearsal has created a fresh dealership, rooftop, invited users, exact roles/grants, settings, lead sources, and governed Customer/Lead and Inventory imports without hand-editing PostgreSQL. | Rehearse the complete setup from supported product/import paths, reconcile counts and relationships, prove safe retry/reversal, and retain an auditable configuration record. |
| PILOT-P1-05 | P1 | Human role UAT and pilot decision | No named pilot dealership/cohort, launch owner, rollback owner, support owner, dealership champion, success criteria, or completed human UAT for Salesperson, Sales Manager, General Manager, and F&I. | Name and authorize the cohort and owners; complete role-based desktop/mobile UAT on the exact release; disposition findings; record dealer sign-off and an explicit GO decision. |

## Conditional scope gates

These items become P1 only when included in the signed first-pilot scope:

- DealerFlow-hosted inventory media requires accepted object storage, exact-origin access controls, upload/order/render/remove behavior, and outage handling.
- Durable document binaries and e-signature require accepted storage, retention, access, signature-provider, and recovery evidence. Existing dealer systems may remain authoritative if this is explicit in scope and operating procedures.
- Provider-backed AI requires tenant configuration, privacy approval, grounded-output evaluation, failure behavior, and a deterministic non-AI workflow. AI is otherwise disabled and non-blocking.

## Sequence

1. Communications/provider acceptance.
2. Vehicle Intelligence bridge or explicit reduced-scope decision.
3. Recovery, monitoring, alerting, and support drills.
4. Fresh-dealership onboarding/import rehearsal.
5. Human role UAT and explicit pilot GO decision.

No production deployment, real customer communication, real dealer import, or pilot GO is authorized by this reconciliation.
