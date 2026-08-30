# DealerFlow P0/P1 Closure Evidence

**Date:** August 30, 2026  
**Starting branch:** `codex/staging-deployment`  
**Starting release:** `2d628cf59d6d79012586da1e9c9babf0dcc5fb54`  
**Source audit:** [Full-System Acceptance Audit](FULL_SYSTEM_ACCEPTANCE.md)

## Scope Decision

The source audit identified no verified P0 application defects. This batch therefore addressed repository-repairable P1 gaps in the primary demo path without adding broad modules or weakening existing launch gates.

The missing Calendar workspace was safely repairable over the existing appointment authority. Persistent pilot import, runtime configuration, R2 provisioning, backup/restore evidence, external monitoring, and support ownership require either a separately governed data implementation or external infrastructure/ownership. They remain open and are not represented as passed.

## Repaired P1 — Calendar

DealerFlow now has a capability-protected Appointment Calendar at `/organizations/{organizationId}/calendar`.

The Calendar:

- reads canonical PostgreSQL appointments rather than creating a second scheduling model;
- requires `appointment.read` through the same server page authority used by other protected directories;
- runs inside transaction-local tenant context;
- embeds membership location restrictions in the SQL query;
- uses each appointment's authoritative timezone for local-day grouping;
- supports bounded seven-day navigation and valid status filtering;
- links every appointment to its Customer Workspace for lifecycle changes;
- exposes Calendar navigation only when `appointment.read` is entitled and granted;
- uses semantic day sections, hierarchical headings, keyboard links, visible focus states, and mobile-safe controls;
- presents an explicit empty state and does not fabricate appointment or KPI data.

Appointment creation, confirmation, arrival, completion, cancellation, and no-show remain owned by the existing Customer Workspace and appointment lifecycle APIs. This preserves one mutation authority while completing the Calendar → Customer transition.

## P0 and Security Regression

No new mutation, public data route, cross-tenant administrator, billing authority, document store, or AI execution path was introduced. Calendar access fails closed at the page capability boundary and again at PostgreSQL RLS/tenant context. The query contains both organization and membership-location restrictions.

The complete regression gate includes the existing two-tenant adversarial matrix and authorization suites for Customer, Lead, task, appointment, communication, Deal, Inventory, media, report, AI, integration, notification, administration, and protected document domains.

## Canonical Demo Story

| Step | Status | Evidence / constraint |
| --- | --- | --- |
| Salesperson login | Pass | Better Auth and role workspace are operational. |
| My Day | Pass with known limits | Authoritative task, Lead, appointment, Deal, and Inventory facts; no fabricated metrics. |
| Lead | Pass | Tenant-scoped intake and repeat-cycle handling. |
| Customer Workspace | Pass | Authoritative profile, activity, interests, Deals, and controls. |
| AI summary / next action | Conditional | Deterministic evidence brief works; model-backed generation depends on provider configuration. |
| Communication / follow-up | Conditional | Consent-aware SMS and manual call/email outcomes exist; customer email drafting is not implemented. |
| Appointment | Pass | Create and lifecycle controls are operational. |
| Calendar | Pass locally | New protected location-scoped weekly view links back to Customer. Staging acceptance awaits deployment. |
| Inventory | Pass | Authoritative physical-unit directory. |
| Vehicle Workspace | Pass | Exact-unit context and honest media states. |
| Deal / Desking | Pass for current scope | Quote, trade, approval, delivery, and overview authorities exist. |
| Sales Manager / GSM | Pass for current scope | GSM uses the canonical Sales Manager permission profile. |
| GM / Owner | Pass for current scope | Executive operating brief and tenant administration. |

## Pilot Scope

The agreed first-pilot scope remains Sales, BDC, Sales Management, Inventory, and Vehicle Workspace. Finance, Service, Recon, billing, and cross-tenant Platform Administration remain excluded.

Persistent import remains the principal repository implementation blocker. Its safe closure requires:

1. tenant-isolated implementation-project and import-batch persistence;
2. protected upload storage and bounded parsing;
3. immutable preview/mapping approval evidence;
4. authorized transactional commit through canonical domain services;
5. row-level outcome and reconciliation reports;
6. batch-owned reversal rules that cannot remove subsequently changed records;
7. disposable-tenant dry-run and malformed/duplicate-record acceptance.

The current preview must not be connected directly to production writes without these controls.

## Remaining P1 Gaps

| ID | Gate | Domain | Evidence | Next action |
| --- | --- | --- | --- | --- |
| FS-001 | Pilot | Runtime | `/api/ready` reports runtime configuration unavailable. | Complete required staging environment and verify exact-release readiness. |
| FS-002 | Pilot | Recovery | No provider backup configuration or restore drill is recorded. | Capture backup settings and complete an isolated timed restore. |
| FS-003 | Pilot | Monitoring | Alert contract exists; external receipt and on-call response are unverified. | Configure a receiver, run a synthetic alert, and record ownership. |
| FS-004 | Pilot | Import | Validation/preview only; no persistent batch, commit, reconciliation, or reversal. | Implement the governed import sequence above as a dedicated batch. |
| FS-006 | Pilot | Support | No named intake, coverage, or escalation evidence. | Establish monitored support ownership and exercise the incident runbook. |
| FS-007 | Inventory pilot | Media | R2 environment and exact-origin CORS are not configured in staging. | Provision R2 and run upload/order/remove/failure acceptance. |

FS-005, the missing Calendar workspace, is closed in repository code and awaits staging deployment evidence.

## Readiness Verdict

- **Demo Ready: CONDITIONAL.** The primary application story now contains a real Calendar transition. The demo must continue to disclose provider degradation and use only approved communication recipients. Exact-release staging acceptance remains required before freezing a demo candidate.
- **Pilot Ready: FAIL.** Runtime, recovery, monitoring, import, support, and media acceptance remain open.
- **Production Ready: FAIL.** All pilot gates plus broader commercial, support, and operational controls remain required.

## Narrow Next Queue

1. Persistent Pilot Import Authority.
2. Staging Runtime, R2, Monitoring, and Recovery Acceptance.
3. Pilot Support Ownership and Exact-Release Role E2E.
