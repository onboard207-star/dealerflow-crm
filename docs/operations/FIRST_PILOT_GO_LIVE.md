# DealerFlow First-Pilot Go-Live Readiness

**Assessment date:** August 30, 2026  
**Pilot scope:** Sales, BDC, Sales Management, Inventory/Vehicle, Dealer Administration, Customer Workspace, appointments/Calendar, and verified communications  
**Excluded:** Finance, Service, Recon, billing activation, Slack, VinSolutions, and cross-tenant Platform Administration

## Current Decision

**FIRST PILOT GO-LIVE: NO-GO**

DealerFlow's core application workflows are suitable for controlled staging demonstration, but the first dealership must not launch until governed import, recovery evidence, external monitoring, support ownership, pilot-tenant provider routing, and R2 media acceptance are verified. No P0 application defect is known. The decision is driven by unresolved P1 launch operations, not speculative product scope.

## Blocker Classification

| ID | Classification | Domain | Evidence | Required closure |
| --- | --- | --- | --- | --- |
| PB-001 | P1 | Import | Current authority validates and previews only. | Persistent tenant-isolated batches, bounded upload, approved mapping, transactional commit, row outcomes, reconciliation, and safe reversal. |
| PB-002 | External P1 | Recovery | No captured Render backup or successful isolated restore evidence. | Record backup scope/time and restore representative tenant, Customer, Inventory, appointment, and communication records. |
| PB-003 | External P1 | Monitoring | Application telemetry exists; external alert delivery/on-call response is unverified. | Configure receiver, run synthetic failure, record receipt and escalation owner. |
| PB-004 | External P1 | Support | No monitored dealer intake, severity owner, or exercised escalation. | Name the support channel/owners and complete one synthetic P1 lifecycle. |
| PB-005 | External P1 | Media | R2 and exact-origin CORS are not configured in staging. | Upload, verify, order, render, remove, and exercise failure against the pilot tenant. |
| PB-006 | External P1 | Providers | Connector framework is tenant-aware, but first-pilot destinations and sender routing do not exist yet. | Approve included channels and verify inbound/outbound/status/failure/tenant routing with test destinations. |

Runtime readiness no longer treats optional AI or media as required application dependencies. Core readiness continues to require authentication, internal jobs, and transactional account email. Optional AI, media, and alerting are returned as explicit `configured` or `not-configured` capabilities and remain fail closed at their feature boundaries.

## Pilot Configuration Record

The following record must be completed before onboarding real data:

| Field | Required value |
| --- | --- |
| Tenant and rooftop IDs | Stable generated DealerFlow identifiers |
| Environment | Pilot production environment, never the demo tenant |
| Pilot owner | Named DealerFlow accountable owner |
| Dealer sponsor/champion | Named dealership decision-maker and operating champion |
| Dates | Start date and planned review date |
| Enabled modules | Only the approved pilot scope |
| Enabled integrations | Only providers with tenant-specific acceptance evidence |
| Pilot users | Named users, roles, and rooftop grants |
| Success criteria | Versioned definitions and baseline dates |
| Support tier | Approved contact and escalation expectations; no unapproved SLA |
| Known limitations | Explicit excluded modules/providers |
| Release | Commit, deployment time, migration version, and feature configuration |
| Commercial state | Free Pilot, Paid Pilot, or Trial; independent from launch state |

No repository authority currently persists this complete record. Until that authority exists, a real pilot may not be marked READY.

## Launch Checklist

| Gate | Status | Current evidence |
| --- | --- | --- |
| Tenant isolation and authorization | VERIFIED | Forced RLS, composite tenant keys, server capabilities, location scope, and adversarial tests. |
| Core Sales/BDC/Manager workflow | VERIFIED IN STAGING | Lead, Customer, task, appointment, Calendar, Inventory, Vehicle, Deal, and manager views. |
| Dealer administration | IN PROGRESS | Users, roles, locations, branding, and integrations exist; support and billing view are absent. |
| Pilot tenant | NOT STARTED | Demo tenant cannot become the pilot tenant. |
| Pilot users and first-login role UAT | NOT STARTED | Invitation/admin mechanics exist; real pilot roster is unknown. |
| Customer/Lead import | BLOCKED | Preview only. |
| Inventory import | BLOCKED | Preview only; catalog configuration remains unresolved. |
| User roster import | BLOCKED | Preview only; invitation must remain a separate approved action. |
| Communications | BLOCKED | Pilot tenant routing/test destinations not verified. |
| AI | OPTIONAL / NOT CONFIGURED | Deterministic briefs work; provider-backed generation must remain disabled until configured. |
| Training assignment/completion | BLOCKED | Current catalog exists; durable assignment/completion does not. |
| UAT and dealer sign-off | NOT STARTED | Requires actual pilot tenant, users, data, and named testers. |
| Monitoring and alerts | BLOCKED | External delivery and ownership missing. |
| Support | BLOCKED | Operational workflow/ownership missing. |
| Backup and restore | BLOCKED | Provider evidence missing. |
| R2 media | BLOCKED | Infrastructure missing. |
| Billing/commercial status | NOT STARTED | Must be explicitly approved; no invoice should be issued. |
| Security regression | VERIFIED LOCALLY | Complete repository gate includes tenant/role/location/protected-domain tests. |

## Role Acceptance Matrix

| Pilot role | Allowed operating scope | Explicitly denied/deferred |
| --- | --- | --- |
| Salesperson | Assigned Leads, Customers, tasks, appointments, Calendar, scoped Inventory/Vehicle, permitted Deal actions, evidence briefs | Tenant administration, role grants, cross-location records, manager approval capability |
| BDC | Lead/Customer response work, tasks, appointments, Calendar, permitted communication | Deal approval, inventory administration, tenant configuration |
| Sales Manager / GSM | Team queues, assignments, appointments, pipeline, Deal attention/approval where granted, reports | Cross-tenant access, Platform Administration, ungranted Finance operations |
| Inventory Manager | Scoped Inventory/Vehicle and governed media when configured | Customer communication, role management, cross-location stock without grant |
| Dealer Admin (Owner/GM) | Tenant users, roles, locations, branding, approved integrations, readiness views | Other tenants, platform commercial data, implicit production or billing activation |

GSM uses the canonical Sales Manager role. There is no independent Dealer Admin system role; Owner/GM capability grants currently provide dealership administration. No Platform Admin role or cross-tenant control plane exists.

## Provider Decisions

| Provider | Pilot decision | Evidence state |
| --- | --- | --- |
| In-app notifications | Include | Canonical task/Deal notifications, recipient RLS, read state, and deep links are tested. |
| Twilio SMS | Conditional | Durable consent/send/status/failure architecture exists; pilot tenant sender, destination safety, and live routing must be accepted. |
| Transactional email | Include for accounts/invites | Resend delivery has staging evidence; pilot sender/domain and recipient acceptance must be reconfirmed. |
| Customer email | Exclude | Only manual outcome recording exists. |
| Slack | Exclude | Not configured and not required for core pilot. |
| OpenAI | Optional | Provider-backed recommendations remain disabled unless configured and accepted; deterministic operating briefs preserve core workflow. |
| Cloudflare R2 | Required for Inventory media pilot | Not configured; launch-blocking if media management is included. |

## UAT Evidence Template

Every pilot test must record: Test ID, role, named tester, release, result (`NOT RUN`, `PASS`, `FAIL`, or `BLOCKED`), evidence link, defect ID, and retest result.

Minimum suites:

- Salesperson: login, My Day, Lead, Customer, approved communication, task, appointment, Calendar, Inventory, Vehicle, Deal, AI state.
- BDC: Lead queue, Customer, response, appointment, confirmation, no-show.
- Manager: exceptions, assignment, appointment oversight, pipeline, Deal attention, team view, brief.
- Inventory: Inventory, Vehicle, accepted media path, missing-data behavior.
- Dealer Admin: users, roles, locations, branding, approved integrations, training visibility, support contact.

No test may be marked PASS solely because a route renders. The action, resulting canonical record, authorization boundary, and failure behavior must be verified.

## Launch State and Change Control

Allowed states are `PRE-LAUNCH`, `READY`, `GO-LIVE`, `HYPERCARE`, `STABLE`, `PAUSED`, and `ROLLED BACK`. State changes require actor, timestamp, release, reason, and audit evidence. No durable launch-state authority currently exists, so the pilot remains `PRE-LAUNCH` and cannot transition to `READY`.

Pilot changes are classified as Critical Fix, Pilot Configuration, Post-Pilot Enhancement, or Future Roadmap. A pilot release requires reason, completed test evidence, staging acceptance, known risk, rollback plan, and exact commit. Production deployment is never implied by a staging branch update.

## Recovery and Offboarding

- Application rollback: deploy the last accepted immutable image/commit, then rerun smoke checks.
- Feature/provider rollback: disable only the affected tenant feature or connector; preserve core records and failure evidence.
- Bad configuration: restore versioned tenant configuration through the audited configuration authority.
- Bad import: use batch-owned reversal only after verifying records have not been subsequently changed. This is not yet implemented.
- Database recovery: restore to an isolated database, validate integrity, and follow an approved cutover. Never reverse migrations blindly.
- Offboarding: suspend access, stop outbound sends, revoke integrations, preserve data, document export/retention, and avoid immediate deletion.

## GO Evidence Required

GO requires a separately created record containing exact release, migration version, tenant/rooftops, feature flags, roles, provider results, import reconciliation, training results, UAT results, known P2/P3 limitations, recovery evidence, support contact, dealer sign-off, and explicit actor/timestamp decision. Missing or failed P0/P1 evidence forces NO-GO.
