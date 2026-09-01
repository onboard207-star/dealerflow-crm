# DealerFlow Product Portfolio Governance

**Authority date:** September 1, 2026  
**Decision:** Reconcile and close pilot dependencies before expanding the product portfolio.

## Purpose

This document defines how DealerFlow decides what exists, how mature it is, whether it may be piloted or sold, and what should be built next. It does not replace domain architecture or acceptance evidence. It connects those authorities through stable capability IDs.

The machine-readable authorities are:

- `config/capability-implementation-registry.json` — capability identity, maturity, implementation, evidence, dependencies, ownership, blockers, and commercial posture.
- `config/product-domain-map.json` — bounded product domains and their record authorities.
- `config/roadmap-outcome-registry.json` — outcome-based Now, Next, Later, and Not Now sequencing.
- `config/module-maturity-catalog.json` — legacy module-facing maturity labels. This remains compatibility metadata and must not override the capability registry.
- `config/commercial-capability-catalog.json` — legacy customer-safe stop-sell labels. It remains fail-closed.

## Current Portfolio Verdict

DealerFlow has a substantial staging-verified dealership operating core. It does not have any capability classified as Pilot Ready, Pilot Proven, GA, Limited Availability, or commercially Supported. This distinction is intentional: implemented or staging-verified software is not automatically operationally ready, proven with a live dealership, or contractually supportable.

The immediate portfolio objective is controlled pilot readiness. Service, recon, commercial billing, the public developer ecosystem, multi-vertical expansion, and finance dashboards must not displace the launch dependencies already recorded in the system acceptance audit.

## Maturity Model

| State | Required meaning |
| --- | --- |
| Proposed | A problem or opportunity is recorded; no approved implementation contract is implied. |
| Specified | Architecture, boundaries, and acceptance intent exist; runtime implementation is not claimed. |
| In Build | Implementation is incomplete and unavailable for acceptance. |
| Code Complete | The scoped implementation and relevant automated checks exist; staging acceptance is not claimed. |
| Staging Verified | The exact scoped workflow has recorded staging evidence. This is not pilot authorization. |
| Pilot Ready | All capability and shared pilot gates have evidence and an authorized controlled launch decision. |
| Pilot Proven | A real pilot has produced accepted operational and outcome evidence. |
| GA | The capability is generally available with production operations and commercial support. |
| Limited Availability | Production use is deliberately constrained by tenant, provider, geography, or contract. |
| Deprecated | Supported only through a governed migration window. |
| Retired | No longer available; retained records follow preservation policy. |
| Blocked | Progress depends on a missing authority, provider, evidence, or external decision. |

Movement is evidence-driven. A release, test suite, demo, documentation set, or UI route alone cannot promote a capability to Pilot Ready or GA.

## Architecture Reconciliation

The product-domain map defines one authority per concern and prevents portfolio names from creating duplicate data models. Current implementation and architecture are aligned around these boundaries:

- Customer is durable identity; Lead is a repeatable buying cycle.
- Vehicle is VIN identity; Inventory Unit is a dealership stock cycle.
- Deal owns retail lifecycle; Quote owns immutable commercial terms; Document is a rendered artifact.
- Domain events record lifecycle evidence; audit logs record actor/change evidence.
- Reporting and AI are scoped projections over canonical records, not alternative authorities.
- Dealer retail finance must never be represented as DealerFlow company finance.

Known architecture gaps are explicit capabilities or blockers, not hidden placeholder authorities: vehicle configuration catalog, durable document storage/signature, service/recon, controlled import commit/reversal, commercial accounts/billing, platform administration, and public extensions.

## Dependency Rules

Hard dependencies must exist and remain acyclic. A hard dependency blocks readiness promotion. A soft dependency may improve an outcome but cannot be silently treated as required. Provider dependencies must identify the external system or human operational authority and retain a blocker until acceptance evidence exists.

Shared pilot dependencies apply across otherwise staging-verified capabilities:

1. Runtime readiness for the exact release.
2. Backup inventory and timed restore proof.
3. External monitoring, delivered alert, and escalation ownership.
4. Controlled import commit, reconciliation, reversal, and dry run.
5. Required provider acceptance and failure-path evidence.
6. Support intake, severity policy, and operating exercise.
7. Resettable pilot scenario and role-based golden-journey acceptance.

## Roadmap Governance

Roadmap items describe outcomes and required evidence, not feature counts or invented delivery dates.

- **Now** closes the first controlled-pilot dependencies.
- **Next** proves repeatability with a second isolated dealership after pilot authorization.
- **Later** establishes commercial and enterprise authorities after pilot evidence.
- **Not Now** holds attractive but nonessential domains that would distract from launch truth.

Demand, revenue impact, confidence, delivery effort, and dates must remain unscored until a named evidence source exists. Missing evidence is UNKNOWN, never zero and never an optimistic estimate.

## Entitlement and Commercial Rules

Feature configuration and capability permissions govern runtime access. They do not declare maturity or sales eligibility. Commercial support is independently fail-closed:

| Commercial state | Rule |
| --- | --- |
| Unsupported | Cannot be sold or promised. May exist in development, staging, or a controlled demo. |
| Pilot Only | Requires at least Pilot Ready maturity, an explicit pilot agreement, tenant restriction, support ownership, and rollback path. |
| Supported | Requires GA or Limited Availability maturity plus operational and contractual support. |

No current capability is commercially Supported. The existing commercial catalog remains stop-sell/unavailable until capability evidence authorizes a deliberate change.

## Coverage Expectations

Every capability promotion should reconcile the following evidence where applicable:

- architecture and data authority;
- implementation references and strict contracts;
- automated tests and production build;
- tenant, role, permission, and location isolation;
- desktop, tablet, mobile, keyboard, and accessibility acceptance;
- loading, empty, error, offline, restricted, and degraded provider states;
- observability, privacy-safe failures, recovery, and rollback;
- provider configuration, delivery, and failure paths;
- migration, reconciliation, retention, and reversal;
- AI evidence, explainability, review, refusal, cost, and latency boundaries;
- exact-release staging or production verification.

Not every capability needs every evidence type. Any omission must be justified by scope, not convenience.

## Decision Records

### PPG-001 — Capability Registry Is Canonical

**Decision:** Stable capability IDs and evidence-backed maturity in the implementation registry are the portfolio authority.  
**Reason:** Prior module catalogs mixed implementation phase, pilot language, and commercial posture.  
**Consequence:** Product surfaces and status reports must link to capability IDs and may not infer readiness from route existence.

### PPG-002 — Staging Verification Is Not Pilot Readiness

**Decision:** Shared operational gates can prevent Pilot Ready promotion even when a workflow is staging-verified.  
**Reason:** Recovery, monitoring, import, provider, and support failures affect the whole pilot.  
**Consequence:** Current core capabilities remain Unsupported until the pilot decision is explicitly authorized.

### PPG-003 — Roadmap Uses Outcomes Without Invented Forecasts

**Decision:** The canonical roadmap uses Now/Next/Later/Not Now and observable success evidence, with no fabricated dates, effort, demand, confidence, or revenue.  
**Reason:** Repository evidence cannot establish market demand or delivery forecasts.  
**Consequence:** Commercial and founder inputs may enrich prioritization later without rewriting implementation truth.

### PPG-004 — No New Broad Feature Family Before Reconciliation

**Decision:** Current pilot blockers take precedence over broad new modules.  
**Reason:** Additional foundations increase surface area without proving a sellable operating system.  
**Consequence:** Service/recon, marketplace, commercial billing, and vertical expansion remain deferred unless required to close an evidenced pilot outcome.

## Technical Debt and Deprecation

The module maturity and commercial catalogs remain compatibility authorities but duplicate part of the new registry. They should be migrated to generated projections only after every consumer is identified and tested. No destructive removal is authorized in this batch.

Future deprecation requires an owner, replacement or retirement rationale, affected tenant inventory, communication plan, data retention/migration plan, deadline approved outside this registry, and verification evidence. Deprecated code must not be deleted merely because a newer design exists.

## Product Health View

The current health view is deliberately evidence-based:

- **Strength:** Tenant-safe CRM, inventory, Deal, workspace, and reporting foundations have staging evidence.
- **Launch risk:** Recovery, monitoring, support, import completion, provider acceptance, and scenario acceptance remain open.
- **Commercial risk:** No capability has pilot proof, GA operations, or Supported status.
- **Architecture risk:** Several future domains have specifications without runtime authorities.
- **Roadmap risk:** Broad portfolio expansion would compete with pilot closure.

Run `pnpm portfolio:check` whenever the capability, domain, roadmap, maturity, dependency, or commercial status changes. Record changed files, validation results, assumptions, evidence dates, and deviations in `docs/BUILD_STATUS.md`.
