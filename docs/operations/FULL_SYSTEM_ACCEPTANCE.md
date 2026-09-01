# DealerFlow Full-System Acceptance Audit

**Audit date:** August 30, 2026  
**Repository branch:** `codex/staging-deployment`  
**Accepted release:** `2d628cf59d6d79012586da1e9c9babf0dcc5fb54`  
**Staging:** `https://dealerflow-staging.onrender.com`

## Executive Verdict

DealerFlow is a coherent multi-tenant automotive retail application foundation with a strong Customer, Lead, Inventory, Deal, task, appointment, communication, reporting, role-workspace, and tenant-administration core. PostgreSQL is the runtime system of record, tenant boundaries fail closed, and the accepted repository release matches staging.

DealerFlow is **conditionally demo ready** for a controlled, presenter-led core workflow. It is **not pilot ready** and **not production ready**. The launch blockers are not hidden: runtime configuration readiness is failing, backup and restore evidence is absent, external monitoring and support ownership are unverified, persistent controlled import is unfinished, and several advertised platform domains remain foundations or honest unavailable states.

No verified P0 application defect was found in this audit. No broad architecture rewrite is justified. Work should continue incrementally from the existing authorities.

| Gate | Verdict | Basis |
| --- | --- | --- |
| Repository integrity | Pass | Branch and upstream agree at the accepted release; working tree was clean at audit start. |
| Staging release reconciliation | Pass | `/api/health` returned the exact accepted release. |
| Core regression suite | Pass | Tenant, authorization, lead, appointment, communication, Deal, document, learning, import-preview, and launch-readiness tests passed. |
| Controlled core demo | Conditional | The seeded tenant and primary records work; unavailable providers and missing Calendar must be excluded or disclosed. |
| First dealership pilot | Fail | Recovery, monitoring, runtime, import, provider-failure, and support gates remain open. |
| Production launch | Fail | Pilot evidence plus durable commercial, support, and operational controls remain incomplete. |

## Evidence and Limitations

This audit used repository history, tracked configuration, migration/schema inspection, architecture and operations documents, automated tests, production builds, and live Render health endpoints. The authenticated staging tenant has previous exact-release desktop and mobile acceptance evidence for the core routes listed in `docs/BUILD_STATUS.md`.

This audit does not claim evidence that cannot be obtained from the repository: Render backup configuration and restore success, external alert receipt, provider-account health, private credential values, or human support ownership. Those are external launch-gate items, not assumptions.

## Repository and Deployment Truth

- Application: Next.js 15 App Router, React 19, strict TypeScript, Tailwind, Radix/shadcn-style primitives, and Lucide icons.
- Package manager/runtime: pnpm; deployment container uses Node 22 Alpine and a non-root standalone Next.js image.
- Persistence: PostgreSQL through Drizzle with migrations `0000` through `0035`.
- Auth: Better Auth backed by the application database.
- Deployment: Render staging with explicit pre-deploy migrations.
- Accepted release: local HEAD, upstream branch, and live liveness release are `2d628cf59d6d79012586da1e9c9babf0dcc5fb54`.
- Readiness: `/api/ready` returns HTTP 503 because `runtime-configuration` is unavailable; database readiness passes.
- `main` is not the deployed source of truth and was not changed or merged during this audit.
- Full local gate: Drizzle migration validation, lint, strict TypeScript, 402 tests across 94 files, and the optimized production build pass.

## Authority and Source Matrix

| Domain | Canonical authority | Runtime status | Duplicate/conflict conclusion |
| --- | --- | --- | --- |
| Organizations and branding | PostgreSQL organizations and versioned organization configurations | Operational | No competing runtime authority. |
| Locations | PostgreSQL locations | Operational | Stable rooftop identity; no Airtable runtime authority. |
| Users, memberships, roles, permissions | Better Auth users plus PostgreSQL memberships, roles, and capabilities | Operational | Presentation roles never expand capability grants. |
| Customers | PostgreSQL customers | Operational | Contact normalization and locking protect identity reuse. |
| Leads/buying cycles | PostgreSQL leads and immutable status events | Operational | Returning buyers create a new Lead while retaining one Customer. |
| Tasks | PostgreSQL tasks and status events | Operational | Notification rows are projections, not a competing task authority. |
| Appointments | PostgreSQL appointments and events | Operational | No calendar projection exists yet. |
| Showroom visits | PostgreSQL visits and events | Operational | Appointment synchronization preserves separate lifecycle purposes. |
| Communications and consent | PostgreSQL communications, consent evidence, and send attempts | SMS operational; email/call limited | Auth email outbox is correctly separate from customer communication. |
| Notifications | PostgreSQL recipient-scoped notifications | Operational for task assignment and Deal approval | Notification state does not replace originating records. |
| Vehicle identity | PostgreSQL vehicles, keyed by canonical VIN | Operational | A vehicle identity is distinct from a dealership inventory cycle. |
| Physical inventory | PostgreSQL inventory units and lifecycle events | Operational | No canonical model/configuration catalog exists. |
| Inventory media | PostgreSQL metadata plus configured object storage | Model operational; staging upload blocked | Actual, CGI, OEM, and reference provenance are intentionally distinct. |
| Vehicle interest | PostgreSQL Lead vehicle interests | Operational | Interests reference canonical buying-cycle and physical-unit records. |
| Deals | PostgreSQL Deals and immutable events | Operational | Deal state is not inferred from quote or inventory alone. |
| Quotes | PostgreSQL immutable quote versions and line items | Operational | Printable proposal is a representation of this authority. |
| Trade appraisals | PostgreSQL versioned appraisals and events | Operational | Accepted trade acquisition creates a new inventory cycle deliberately. |
| Deliveries | PostgreSQL deliveries and status events | Operational | Deal delivery requires completed handoff evidence. |
| AI recommendations | PostgreSQL recommendation runs with server evidence | Partial | Role briefs are deterministic projections; provider-backed generation is separately disclosed. |
| Integrations | PostgreSQL connector accounts/events/mappings plus deployment secrets | Partial | External mappings do not replace DealerFlow domain authority. |
| Audit history | PostgreSQL audit logs and immutable domain events | Operational | Domain events and audit records have complementary purposes. |
| Documents | Quote authority plus pure document contracts | Foundation only | No general document/template/generated-file authority exists. |
| Training/help | Versioned checked-in catalog | Static foundation | No assignment, progress, acknowledgment, or support-ticket persistence. |
| Billing/commercial | None | Not built | Website demo preview is not a lead authority. |
| Platform administration | None | Not built | Dealer administration is tenant-scoped and must not be mistaken for platform administration. |
| Airtable | Legacy/control-plane and migration analysis only | Not used at runtime | Do not reconnect runtime reads; retire only after reconciled migration evidence. |

## Duplicate and Legacy Audit

The following apparent overlaps are intentional boundaries, not duplicates:

- Customer versus Lead: durable person/organization identity versus repeat purchase cycle.
- Vehicle versus Inventory Unit: VIN identity versus a physical dealership stock cycle.
- Communication versus outbound send attempt: customer-visible history versus provider delivery orchestration.
- Role workspace brief versus AI recommendation run: deterministic scoped operating projection versus reviewed provider output.
- Quote versus document: immutable commercial terms versus a rendered artifact.
- Domain events versus audit log: lifecycle evidence versus cross-domain actor/change evidence.

Confirmed missing authorities must not be filled with parallel JSON, Airtable, or UI-local data. New persistence should extend PostgreSQL and the existing service/provider boundaries. Airtable retirement is deferred until row counts, relationships, retained history, and rollback evidence are reconciled.

## Prior Batch Reconciliation

| Capability/batch | Classification | Evidence-based status |
| --- | --- | --- |
| App shell, design system, reusable customer components | Complete | Responsive shell and shared UI foundations are in production code. |
| Tenant/auth/authorization foundation | Complete | Forced RLS, composite tenant keys, capability checks, and adversarial tests exist. |
| CRM core and lead intake | Complete for current scope | Customer reuse, repeat buying cycles, queues, and lifecycle evidence are authoritative. |
| Customer Workspace | Complete for current scope | Live customer context and core actions are composed from authoritative queries. |
| Inventory and Vehicle Workspace | Partial | Unit lifecycle works; catalog hierarchy and configured staging media storage do not. |
| Deal, quote, trade, delivery | Complete for current scope | Controlled transitions and lead-to-sale evidence exist; full F&I is not claimed. |
| Role-based workspaces | Partial | Most current dealership roles have useful views; GSM is mapped to Sales Manager and Recon/Service remain incomplete. |
| Mobile UX | Complete for verified routes | Core routes pass prior 320–430px acceptance; Calendar and some future modules do not exist. |
| AI operating layer | Partial | Evidence-based briefs and reviewed recommendations exist; conversational/drafting/execution provider features do not. |
| Communications and command center | Partial | SMS and operational exceptions exist; customer email, Slack, and generic automation do not. |
| Tenant administration | Partial | Dealer-level locations, users, roles, branding, integrations, and readiness exist; groups/platform/billing do not. |
| Production hardening | Partial / externally blocked | Security and telemetry contracts exist; live readiness, backup, monitoring, and support evidence remain open. |
| First dealer launch | Partial | Preview validation exists; commit, reconcile, rollback, and launch acceptance do not. |
| Dealer self-service/commercial operations | Foundation | Sensitive role confirmation and account health exist; subscription and commercial authorities do not. |
| Public website | Foundation | Public pages are truthful; demo requests are not transmitted or persisted. |
| Integration platform | Foundation | Twilio is the verified connector path; OpenAI is contract-only and other connectors are absent/disabled. |
| Document platform | Foundation | Quote printing and pure contracts exist; generation, storage, signature, and packet workflows do not. |
| Learning/support | Foundation | Role-aware content and search exist; progress, assignments, contextual drawers, and tickets do not. |

## Roles and Permissions

The canonical system roles are Owner, General Manager, Sales Manager, Salesperson, BDC, Finance Manager, Inventory Manager, Service Manager, Service Advisor, Controller, and Receptionist. Dealer Principal maps to Owner; General Sales Manager maps to Sales Manager in the fictional template. There is no independent Recon, Dealer Admin, or Platform Admin system role.

| Persona | Workspace/readiness | Conclusion |
| --- | --- | --- |
| Salesperson | Usable | Scoped work queue and Customer workflow; not a complete DMS replacement. |
| BDC | Usable | Lead and follow-up focus; customer email and advanced sequences absent. |
| Sales Manager / GSM | Usable | Shared Sales Manager role; Deal approvals and team priorities exist. |
| GM / Owner | Usable | Executive and tenant-admin surfaces exist; no dealer-group rollup. |
| Finance / Controller | Usable but limited | Deal visibility and controls exist; no lender, credit, funding, or accounting authority. |
| Inventory | Usable | Unit operations and Vehicle Workspace exist; catalog/media provisioning gaps remain. |
| Reception | Usable but limited | Arrival and appointment-oriented context; no telephony console. |
| Service Manager / Advisor | Honest unavailable state | Permission profiles exist, but authoritative service work orders are not built. |
| Recon | Not built | No canonical role, work queue, inspection, or cost authority. |
| Dealer Admin | Partial through Owner/GM | Tenant configuration exists; no separately assignable administrator role. |
| Platform Admin | Not built | No cross-tenant control plane or implicit access. |

## Workspace Acceptance

| Workspace | Status | Notes |
| --- | --- | --- |
| Role home (Sales/BDC/Manager/GM/Finance/Inventory/Controller/Reception) | Operational for current scope | Server-scoped facts, queues, and deep links. |
| Customer Workspace | Operational | Strongest end-to-end operating surface. |
| Vehicle Workspace | Operational | Exact-unit identity, history, links, and honest media fallback. |
| Deal Desking | Operational overview | No lender or full desk worksheet engine. |
| AI Workspace | Partial | Explainable briefs; provider-dependent conversation and execution unavailable. |
| Operations Command Center | Operational | Exceptions and truthful provider health. |
| Dealer Administration | Partial | Tenant settings only. |
| Training Center | Partial | Static governed learning content; no learner records. |
| Calendar | Not built | Appointment domain exists without a calendar workspace. |
| Recon | Not built | No authoritative domain. |
| Service | Not built | Honest module-unavailable views only. |
| Website Analytics / Social | Honest disconnected states | No fabricated provider metrics. |
| Platform Admin / Billing / Support / Demo Control | Not built | No canonical routes or data authorities. |

## Core Workflow Acceptance

### Lead to Sale to Returning Customer

The primary automotive relationship model is correct: one durable Customer can own many Leads over time; each Lead represents a buying cycle; interests connect that cycle to inventory; a Deal connects the same Customer/Lead/unit; delivery closes the Lead without closing the Customer. Previous authenticated staging acceptance completed a sale and then opened a second independent buying cycle for the same Customer while preserving the prior timeline.

The current workflow supports intake, assignment context, task/appointment preparation, inventory interest, Deal creation, quote, trade, approval, delivery, and return-cycle continuity. It does not yet provide a generic workflow/rules engine, persistent campaign sequences, a Calendar workspace, or a complete customer-email channel.

### Inventory

VIN identity and physical stock cycles are separate and correct. Inventory status, pricing, media metadata, customer interest, Deal hold/sale, and trade acquisition are linked. The missing architectural layer is a canonical year/make/model/trim/configuration catalog; DealerFlow cannot yet reliably resolve a physical unit to normalized configuration/features/colors without adding that authority.

### Finance and Documents

Quotes, appraisals, Deal approvals, and delivery handoff are operational with strict monetary contracts. Credit applications, lender decisions, funding, accounting, compliance documents, durable generated PDFs, private storage, electronic signatures, and Deal packet completeness are not implemented. Finance-sensitive access is capability-scoped, but there is not yet finance-specific sensitive persistence to validate.

### AI

DealerFlow distinguishes FACT, RECOMMENDATION, and UNKNOWN, cites evidence, stores reviewed recommendation runs, and avoids exposing hidden reasoning. Deterministic role briefs are available without a model. OpenAI-backed recommendations require deployment configuration. Conversational assistance, drafting, streaming, and execution are unavailable; the product must continue to fail closed rather than imply autonomous action.

### Communications and Automation

Consent-aware SMS has the mature provider path, including quiet hours, durable attempts, delivery reconciliation, and exception handling. Transactional auth/invite email has a separate outbox. Customer email is manual outcome evidence, calls are manually logged, Slack is absent, and notifications cover task assignment and Deal approval. There is no general-purpose workflow engine.

## Demo and Pilot Data

The deterministic fictional dealership template includes 24 rolling months, 1,440 historical Leads, 432 delivered sales, 48 current inventory units, 36 active opportunities, and 26 fictional staff. Staff use reserved `.invalid` addresses and cannot authenticate. Prior staging reconciliation found zero orphan Deals or vehicle interests.

This is credible presentation data, not a resettable Demo Control Center. A presenter must use a real operator account and the controlled tenant. Reset, scenario selection, persona switching, and automated reseeding are not implemented.

## Security, Reliability, Accessibility, and Performance

- Tenant boundaries: composite tenant keys, forced RLS, transaction tenant context, scoped queries, and bilateral adversarial denial tests.
- Authorization: deny by default; roles are presentation context while capabilities and location grants remain authoritative.
- Secrets: deployment references and server-only resolution; tracked-source scans have not identified embedded credentials.
- Webhooks/workers: authenticated, bounded, idempotent, and telemetry-aware.
- Logging: structured correlation-aware telemetry with sensitive-key removal.
- Accessibility/mobile: semantic landmarks, focus states, keyboard paths, 44px mobile controls, and prior no-overflow verification across core routes.
- Performance: bounded pagination, indexes, server projections, and standalone production builds exist; no production-scale load or Core Web Vitals evidence is claimed.
- Recovery: runbooks exist, but backup inventory and restore-drill evidence do not.

## Gap Register

| ID | Severity | Environment | Gap | Required closure evidence |
| --- | --- | --- | --- | --- |
| FS-001 | P1 | Staging/Pilot | Runtime configuration readiness is unavailable. | Exact-release `/api/ready` HTTP 200 with all required checks. |
| FS-002 | P1 | Pilot/Production | Backup and point-in-time recovery evidence is absent. | Provider settings capture and successful timed restore drill. |
| FS-003 | P1 | Pilot/Production | External monitoring, alert receipt, and on-call ownership are unverified. | Synthetic check, delivered alert, escalation owner, and drill. |
| FS-004 | P1 | Pilot | Addendum September 1: transactional demo/pilot commit, applied-record reconciliation, and guarded reversal are code complete locally; exact-release migration/staging evidence and an authorized pilot dry run remain open. | Apply migration `0039`, verify commit/reconciliation/reversal and isolation in staging, then complete an authorized disposable-tenant dry run. |
| FS-005 | Closed locally | Demo/Pilot | Calendar workspace was missing. | Implemented as a capability- and location-scoped canonical appointment view; staging acceptance remains. |
| FS-006 | P1 | Pilot | Support ownership and incident intake are undefined. | Named coverage, monitored channel, severity/SLA policy, and runbook exercise. |
| FS-007 | P1 | Inventory pilot | Staging R2 media storage is unconfigured. | Three-photo upload, verify, order, remove, and failure-path acceptance. |
| FS-008 | P2 | Product | Canonical vehicle catalog/configuration hierarchy is absent. | Governed catalog authority and unit-to-configuration reconciliation. |
| FS-009 | P2 | Product | Service and Recon authorities are absent. | Separate scoped schemas, permissions, lifecycle services, and workspaces. |
| FS-010 | P2 | Product | General document persistence/generation/signature is absent. | Versioned templates, generated artifacts, private storage, access, and provider acceptance. |
| FS-011 | P2 | Product | Customer email, Slack, and generic automation are absent. | Provider contracts, consent/delivery evidence, rule authority, and failure UX. |
| FS-012 | P2 | Commercial | Website demo capture, commercial accounts, billing, and metering are absent. | Persistent deduplicated funnel, account/subscription authority, and audit controls. |
| FS-013 | P2 | Operations | Training progress, contextual help, support tickets, and content admin are absent. | Durable learner/support models and permissioned workflows. |
| FS-014 | P2 | SaaS | Dealer-group and platform administration are absent. | Explicit cross-tenant authority with isolation, audit, and no implicit access. |
| FS-015 | P3 | Demo | No resettable Demo Control Center or persona switching. | Governed reset/scenario service that cannot affect non-demo tenants. |

There are no verified P0 gaps. P2/P3 work must not displace the P1 launch gates.

## Readiness Scorecards

Scores represent demonstrated acceptance, not feature-count optimism.

| Dimension | Score | Summary |
| --- | ---: | --- |
| Core CRM and Customer workflow | 86/100 | Strong authority and live end-to-end evidence; Calendar and email automation remain gaps. |
| Inventory and Vehicle | 76/100 | Physical-unit model is strong; media provisioning and catalog hierarchy are incomplete. |
| Deals and Finance | 78/100 | Deal/quote/trade/delivery are controlled; full F&I and accounting are outside current authority. |
| AI | 62/100 | Explainable evidence model is strong; configured provider experiences and safe action layer are limited. |
| Tenant security and authorization | 90/100 | Strong RLS/capability evidence; platform administration is intentionally absent. |
| Mobile and accessibility | 84/100 | Core routes are verified; future workspaces need their own acceptance. |
| Integrations and communications | 60/100 | Twilio path is mature; other connectors and customer email are incomplete. |
| Operations and recovery | 42/100 | Good application contracts, insufficient external operational proof. |
| Dealer onboarding and support | 38/100 | Template and preview exist; persistent import, training evidence, and support ownership do not. |
| Commercial SaaS readiness | 24/100 | Public foundation exists; billing, metering, platform control, and funnel persistence do not. |

**Overall:** Demo readiness 78/100 (conditional), pilot readiness 49/100 (fail), production readiness 34/100 (fail).

## Final Implementation Sequence

1. **Launch-gate closure:** repair runtime configuration, configure R2, prove backup/restore, external monitoring, provider failure handling, and support ownership. Do not add product scope in this batch.
2. **Controlled dealer import:** add upload, transactional staged commit, row-level reconciliation, rollback, and a dry run against a disposable tenant.
3. **Calendar and communication completion:** build a canonical responsive appointment calendar and finish the explicitly selected pilot communication channels without introducing a generic automation engine prematurely.
4. **Pilot acceptance:** execute exact-release desktop/mobile role tests, security/accessibility regression, seed/import reconciliation, recovery drill, provider-failure tests, and dealer sign-off.
5. **Vehicle catalog and media maturity:** add governed catalog/configuration identity only after source/licensing decisions; reconcile every physical unit and complete media provider acceptance.
6. **Document and F&I pilot slice:** implement only approved persistent documents, storage, signatures, and finance controls required by the first dealer.
7. **Service/Recon or commercial SaaS expansion:** choose based on contracted pilot demand. Do not build both speculatively.
8. **Commercial/platform layer:** add demo capture, account/subscription/metering, dealer-group and platform administration, support, and training persistence before a general paid launch.

## Acceptance Conclusion

The codebase should remain on its current architecture. PostgreSQL domain authorities, explicit tenant boundaries, capability-driven services, and honest unavailable states are the correct foundation. The fastest responsible path is to close the seven P1 operational and pilot gaps, prove one controlled dealer launch, and only then widen the product surface.
