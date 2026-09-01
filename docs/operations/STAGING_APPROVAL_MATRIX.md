# DealerFlow Staging Approval Matrix

**Record:** `HGR-20260901-001`  
**Starting commit:** `03d09bdfd511f1c83b5bef6d457ce54c35df808a`  
**Scope:** staging-only; production remains closed.

| Gate | Description | Lane / state | Evidence | Missing requirement | Risk | Recommended decision | Exact approved action | Rollback or containment | Dependents |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HG-STG-001 | Exact-candidate staging deployment | Staging activation / Blocked: ambiguous environment | REL-CAND-20260901-003 | Render labels the environment `Production`; the DB also contains an active production-class tenant | High | NEEDS_HUMAN_DECISION | Provision or move resources into an explicit isolated Render Staging environment and database | Do not deploy; current healthy release remains live | DWI-PILOT-003, 006, 007 |
| HG-STG-002 | Migration 0039 | Staging activation / Blocked: ambiguous environment | EVD-IMPORT-TEST-001 | Isolated staging target; current schema is valid through 0038 and PITR is available | High | NEEDS_HUMAN_DECISION | After isolation, capture recovery state and use the reviewed pre-deploy migration path | No migration applied; retain 0038 | DWI-PILOT-006 |
| HG-STG-003 | Synthetic seed/reconciliation | Pilot closure / Blocked: exact release absent | EVD-RESET-001 | Isolated DB and exact deployed release | High | APPROVE_WITH_CONDITION | Seed only `org_demo_first_pilot_v1` after isolation | No seed ran | DWI-PILOT-007 |
| HG-STG-004 | Guarded reset/reseed | Pilot closure / Blocked: exact release absent | EVD-RESET-001 | Deployed guarded harness and clean isolated fixture | High | APPROVE_WITH_CONDITION | Run once only after exact-release seed reconciliation | No reset ran | DWI-PILOT-007 |
| HG-STG-005 | Synthetic import/reversal | Pilot closure / Blocked: exact release absent | EVD-IMPORT-TEST-001 | Isolated DB, migration 0039, import endpoints | High | APPROVE_WITH_CONDITION | Exercise only synthetic batch data after isolation | No import ran | DWI-PILOT-006 |
| HG-STG-006 | Smoke and acceptance harness | Pilot closure / Partial stale-release smoke passed | Current runtime observation | Exact release and authenticated demo-only workspace | Low | APPROVE_WITH_CONDITION | Repeat exact health/security and journeys after isolation; current commit `856c7a0` passed basic smoke | No mutation occurred | DWI-PILOT-003, 007 |
| HG-STG-007 | Provider sandbox paths | Provider acceptance / Needs configuration | Missing provider evidence | R2, Twilio, AI, alerting, sandbox endpoints and test sinks; current Resend identity is not test-isolated | High | NEEDS_CONFIGURATION | Configure restricted sandbox/test providers only in isolated staging; do not use current Resend for this exercise | No provider transaction or send occurred | DWI-PILOT-003 |
| HG-PILOT-001 | Named operational owners | Human gate / Blocked | EVD-OWNER-DECISION-001 missing | Named launch, rollback, support owners and coverage | High | NEEDS_HUMAN_DECISION | Authorized owner records and acknowledges roles | Pilot remains NO_GO | DWI-PILOT-005, 001 |
| HG-PILOT-002 | Non-demo pilot import dry run | Human gate / Blocked | EVD-IMPORT-DRYRUN-001 missing | Exact pilot tenant/operator authorization | High | NEEDS_HUMAN_DECISION | Separate authorization is required; this packet covers demo only | Keep non-demo imports preview-only | DWI-PILOT-006, 007 |
| HG-PROD-001 | All production and other enumerated high-risk actions | Production / Closed | None | Separate explicit production authorization and all readiness gates | Critical | KEEP_CLOSED | None | Leave production unchanged | None |

Machine-readable authority is maintained in `dealerflow/execution/HUMAN_GATE_RESOLUTION.json`. A recommendation is not evidence of execution: each staging gate changes state only after its exact preconditions and acceptance evidence pass.
