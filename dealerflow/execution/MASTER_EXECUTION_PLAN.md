# DealerFlow Autonomous Execution Plan

## Mission

Continuously advance the highest-priority eligible AUTO work while preserving product authority, tenant isolation, evidence, and explicit human gates. Autonomy removes waiting; it does not authorize production launch, destructive operations, real customer communication, billing, lender/credit submission, production e-signature or DMS actions, recording, legal claims, or security-risk acceptance.

## Canonical Control Layer

- Queue: `EXECUTION_QUEUE.yaml` (JSON-compatible YAML 1.2 and the sole delivery-state authority)
- Current handoff: `CURRENT_STATE.md`
- Policy: `execution-policy.json`
- Decisions/risks/milestones: `governance-registry.json`
- Human-readable decisions: `DECISIONS.md`
- Blockers: `BLOCKERS.md`
- Human gates: `HUMAN_GATES.md`
- Evidence: `EVIDENCE/`
- Completion reports: `COMPLETION_REPORTS/`
- Consumed batch records: `BATCHES/`

Capability maturity remains in `config/capability-implementation-registry.json`; roadmap authority remains in `config/roadmap-outcome-registry.json`; repository code and tests remain implementation truth.

## Runner Loop

1. Run `pnpm execution:check` and `pnpm execution:next`.
2. Resume an eligible IN_PROGRESS AUTO item before opening READY work at the same priority.
3. Record the starting commit and mark the queue item IN_PROGRESS.
4. Read only its governing specifications and inspect existing implementation.
5. Implement the minimum coherent, non-destructive change.
6. Run targeted tests, then required integration/security checks and the full repository gate.
7. Capture commit-, release-, environment-, and tenant-scoped evidence.
8. Commit the bounded change and write its completion report.
9. Reconcile queue, current state, blockers, decisions, human gates, capability maturity, and release evidence.
10. Select the next eligible AUTO item without waiting.

Blocked and REVIEW work does not stop independent AUTO work. HUMAN_GATE actions are accumulated and never executed without explicit authorized approval.

## Stop Conditions

Stop only for a P0 security/data-loss/isolation finding, unsafe or irreversible risk, no independent work beyond a human gate/provider secret, exhausted queue, or ambiguity that would require fabrication. Record the exact safe stopping point and next deterministic action.

## Current Build Order

1. `DWI-PILOT-002` — reversible controlled-import implementation.
2. `DWI-PILOT-004` — governed synthetic reset and acceptance harness.
3. `DWI-MAINT-001` only if pilot AUTO work is blocked and the change remains bounded.
4. REVIEW items `DWI-PILOT-006`, `DWI-PILOT-003`, and `DWI-PILOT-007` may be prepared but not activated.
5. HUMAN_GATE `DWI-PILOT-005` waits for named accountable owners.

Scale, enterprise, ecosystem, and multi-vertical work remain deferred.
