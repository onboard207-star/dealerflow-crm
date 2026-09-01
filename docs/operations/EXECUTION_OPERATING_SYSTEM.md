# DealerFlow Execution Operating System

**Authority date:** September 1, 2026  
**Current outcome:** First Pilot Reliable  
**Pilot decision:** NO_GO

## Purpose and Authorities

DealerFlow now has one checked-in execution model that converts portfolio truth into bounded delivery work. It aggregates status and evidence; it does not replace the authority that produced them.

| Concern | Authority |
| --- | --- |
| Product capability and maturity | `config/capability-implementation-registry.json` |
| Roadmap outcomes | `config/roadmap-outcome-registry.json` |
| Architecture and product decisions | Architecture documentation and, when connected, Architecture Portal |
| Code change execution | GitHub issue/PR linked by stable work-item ID |
| Delivery state and cross-source reconciliation | `config/delivery-work-registry.json` |
| Release evidence | `config/delivery-evidence-registry.json` |
| Release train and gates | `config/release-train-registry.json` |
| Decisions, risks, and milestones | `config/execution-governance-registry.json` |
| Workflow policy | `config/execution-policy.json` |

Google Docs, Airtable, founder requests, support reports, provider notices, and Codex batches are intake sources. They must link to a stable `DWI-*` ID rather than create parallel completion truth.

## Source Audit

At the audit point, signed-in GitHub showed zero open issues, zero pull requests, and zero milestones. The Projects inventory was not conclusively available. The repository had one quality workflow but no issue or pull-request templates. No Architecture Portal connector, export, or checked-in implementation registry was available. Airtable remains legacy/migration analysis and is not an execution authority. The current operating queue was reconstructed from the portfolio registry, pilot manifests, system acceptance evidence, and operations documents.

Unknown external inventory is recorded as unverified, not empty. A future connector may reconcile it without changing stable work-item IDs.

## Work Lifecycle

The canonical states are Intake, Triaged, Ready, In Progress, In Review, Verification, Blocked, Done, Deferred, and Cancelled.

```text
Intake → Triaged → Ready → In Progress → In Review → Verification → Done
                    ↘ Blocked ────────────────↗
Triaged → Deferred | Cancelled
```

Done requires all required acceptance evidence to be current. A merged branch, passing unit test, document, or deploy alone is insufficient. A document-only specification may be Done as documentation while its product capability remains Proposed or Specified.

Blocked items record blocker type, owner area, exact reason, deterministic next action, and unblock condition. Unknown blockers require an investigation action. A resolved blocker resumes the same work item; it does not create a duplicate.

## Priority, WIP, and Maintenance

P0 is reserved for critical security, data, or outage events. P1 is reserved for evidenced pilot, release, or customer-critical blockers. Strategic horizon remains separate so a future strategic idea cannot masquerade as an incident.

The configured WIP limits are safety constraints, not capacity estimates. Critical incidents allow one active focus. Pilot closure allows three non-blocked active items. Productization and platform/reliability each allow one. Scale/enterprise and research/later permit no active implementation during First Pilot Reliable. Blocked items remain visible but do not consume implementation WIP.

The platform/reliability lane protects maintenance work involving security, supportability, dependency upgrades, providers, technical debt, and data health. A supportability or security threat may outrank feature work after evidence-based triage.

## Intake and Dedupe

Every request is classified Fix Now, Schedule, Investigate, Defer, Duplicate, or Reject/Not Planned. Rationale is preserved for deferred and rejected work.

Before creating a work item:

1. Search stable work IDs, capability IDs, source references, affected records, and underlying user need.
2. Add new tenant or user evidence to the existing item when the need is the same.
3. Preserve tenant-specific context without turning one request into universal demand.
4. If the capability already exists, verify gaps instead of rebuilding it.
5. If it is partially implemented, create only bounded gap work.
6. If it is Later or Not Now, keep it inactive unless a recorded decision changes the roadmap.
7. If sources contradict, use a decision/supersession record before implementation.

## Definition of Ready and Done

The complete rules are machine-readable in `config/execution-policy.json`. Ready requires a linked outcome/capability, bounded scope, acceptance criteria, known dependencies, authority, owner area, inputs, and evidence requirements.

Done varies by class:

- Code requires regression coverage, lint, strict TypeScript, production build, environment verification where applicable, rollback, and reconciliation.
- Migrations require consumer inventory, expand/backfill/verify/cutover, isolation, reconciliation, rollback, and a separate destruction gate.
- Integrations require credential boundaries, sandbox/staging success, failure behavior, observability, and tenant acceptance where applicable.
- Documentation and architecture require contradiction resolution and must not inflate implementation maturity.
- Support and training require named ownership, exercised paths, and truthful limitations.

## Release Train

Every release records identity, branch/tag/commit, capabilities, work items, migration state, provider/config/template/prompt/flag versions, target cohort, gate evidence, known issues, rollback, documentation, support notes, and separate internal, implementation, and customer-safe notes.

Deployable, Deployed, Enabled, and Supported are independent dimensions:

- Deployable means repository, migration, tenant-isolation, and security gates permit a bounded artifact to move.
- Deployed means that exact artifact is verified in the target environment.
- Enabled means the target tenant/cohort has the capability configuration on.
- Supported means maturity, provider, operations, training, and commercial obligations are authorized.

A documentation-only or dark release can be deployable while provider, support, and pilot gates remain blocked. It cannot be represented as enabled or supported.

Emergency hotfixes require a scoped work item, regression evidence, deployment verification, release history, and mainline reconciliation. Production-only mystery changes are prohibited.

## Evidence Freshness and Change Failure

Evidence records commit, release, environment, tenant scope, verification time, source, type, and maximum age. Current evidence from another commit cannot verify a release gate. Expired evidence is reopened rather than carried forward.

Relevant authorization, schema, provider, configuration, or workflow changes require their affected evidence to be rerun even before the maximum age. The validator enforces commit alignment for verified release gates; maintainers must update scope-specific evidence when impact changes.

Failed deploys, rollbacks, hotfixes, escaped defects, migration failures, and provider regressions should become change-failure evidence linked to a work item and release. Deployment frequency, lead time, failure rate, and restore time remain unavailable until reliable event history exists; they must not be backfilled from guesses.

## Provider, Migration, and Incident Flows

Provider change:

```text
Notice/deprecation/auth/pricing change → impact inventory → linked work → sandbox/staging test → rollout → monitoring → registry reconciliation
```

Migration change:

```text
Schema/data change → consumer inventory → expand → backfill → verify → cut over → deletion readiness → separately authorized retirement
```

Incident flow:

```text
Detect → contain → restore → root cause → permanent fix → regression evidence → runbook/monitoring update → capability and roadmap reconciliation
```

A recurring incident cannot close with only a manual workaround unless that temporary debt is explicitly accepted and tracked.

## Operating Cadence

- Weekly planning selects the current outcome, fresh evidence, Ready work, WIP, blockers, maintenance need, and explicit commitments.
- Midweek review examines P0/P1, blocker transitions, release impact, new failures, and material decisions.
- Weekly close records what shipped or was proved, what did not, why, new evidence, carryover, decisions, and roadmap/capability reconciliation.

No story points, velocity, delivery dates, or capacity claims are recorded without real team history.

## Decision and Risk Boundaries

Codex may proceed with bounded deterministic refactors, tests, documentation reconciliation, safe additive migrations with gates, UI corrections, known-spec work, and registry linkage. Human decisions remain mandatory for pilot/production launch, unapproved irreversible destruction, commercial/legal commitments, certifications, security-risk acceptance, and materially ambiguous product/architecture choices.

The current decision queue contains only material owner questions: accountable pilot operating ownership and the eventual named pilot cohort. It does not escalate routine implementation choices.

Risks use qualitative levels because no reliable numeric probability model exists. Each active risk has a trigger, mitigation, contingency, owner area, affected milestone, and linked work.

## Views and Commands

The execution views are generated from the same registries rather than maintained by hand:

```bash
pnpm execution:check
pnpm execution:brief
node scripts/validate-execution-system.mjs --view eod
node scripts/validate-execution-system.mjs --view executive
node scripts/validate-execution-system.mjs --view engineering
node scripts/validate-execution-system.mjs --view implementation
node scripts/validate-execution-system.mjs --view release-notes
```

The Daily Build Brief is the canonical resumption artifact. The EOD handoff records completed work, verification, evidence, blockers, decisions, release impact, exact next order, and a safe stopping point. Audience views intentionally hide irrelevant engineering or commercial detail.

No application dashboard was added in this batch. A cross-tenant internal dashboard would require an explicit platform-admin authority, persistence/update workflow, and access model that do not currently exist. Generated repository views provide truthful operating visibility without weakening tenant isolation or presenting static configuration as a live product feature.

## Exact First Execution Cycle

The first implementation cycle is `DWI-PILOT-002`, controlled pilot import:

1. Inventory current staging models, uniqueness constraints, relationships, and import-batch lifecycle.
2. Define transactional commit and deterministic idempotency over accepted staged rows.
3. Produce reconciliation counts and row-level failures without leaking tenant data.
4. Add reversible compensation bounded to records created by the import batch.
5. Test tenant isolation, duplicate replay, partial failure rollback, relationship integrity, and reversal.
6. Run migration validation, lint, strict TypeScript, relevant tests, full tests, and production build.
7. Run a controlled pilot dry run only when a target tenant and operator approval exist.
8. Bind evidence to the exact release, then move the work through Verification to Done.

While code work proceeds, `DEC-PILOT-001` and provider provisioning may advance independently. The next feature family remains blocked.
