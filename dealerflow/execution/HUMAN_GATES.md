# DealerFlow Human Gates

## HG-PILOT-001 — Assign Operational Owners

- Queue item: `DWI-PILOT-005`
- Requested action: name the launch decision owner, rollback owner, and monitored support owner with acknowledged coverage.
- Why approval is required: these are accountable human operating commitments.
- Evidence: `config/pilot-launch-manifest.json` records the fields as missing; `EVIDENCE/registry.json` records owner decision evidence as missing.
- Risk: an incident could lack an authorized decision, rollback executor, or support escalation path.
- Recovery: keep pilot cutover NO_GO until ownership and exercises are verified.
- Alternative: do not launch a pilot.
- Post-approval action: update the pilot manifest and evidence registry, then execute reviewed recovery/support exercises.

## HG-PILOT-002 — Authorize Pilot Import Dry Run

- Queue item: `DWI-PILOT-006`
- Requested action: authorize the exact pilot tenant and operator after import implementation passes.
- Why approval is required: the action writes and reverses scoped records in a real target tenant.
- Risk: incomplete or incorrectly scoped data mutation.
- Recovery: transactional rollback and batch-bounded reversal; preserve evidence.
- Alternative: retain preview-only behavior.
- Post-approval action: run the documented dry-run command for the exact tenant and capture reconciliation/reversal evidence.

## HG-PILOT-003 — Pilot and Production GO

No command is currently eligible. GO requires every mandatory gate, a named cohort, exact release evidence, and explicit authorized approval. Deployment and activation remain prohibited.
