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

## HG-STG-001 — Resolve Render Environment Isolation

- Observed service: `dealerflow-staging` / `srv-da70hdc9v7es739ona0g`, with `APP_ENV=staging`.
- Conflicting authority: Render places the service and `dealerflow-staging-db` under an environment labeled `Production`; the database contains both an active `demo` tenant and an active `production`-class tenant.
- Current release: `856c7a02284588330128c332cdb48db0f3fc2be0`, not the reviewed gate-resolution candidate.
- Required human action: provision or move the service and database into an explicit isolated Render Staging environment with no production-class tenant data, then confirm the new service/database identifiers.
- Until resolved: do not deploy, migrate, seed, reset, import, or activate providers on the current mixed environment. Non-destructive health inspection remains allowed.
- Production remains NO_GO.

### Resolution evidence — September 1, 2026

- Isolated Render environment: `DealerFlow Staging` / `evm-dabjhoss728c73fhllk0`.
- Isolated service: `dealerflow-isolated-staging` / `srv-dabk8d610ojc73ds3afg`.
- Isolated database: `dealerflow-isolated-staging-db` / `dpg-dabjm5e1egvs73b1s92g-a`.
- Exact deployed commit: `028c198d226d1979ed539c671b0719410f8c0d33`.
- The fresh database contained no application tables or organizations before migration and no production-class organizations afterward.
- The reviewed migration chain applied through `0039`; its final ledger hash matches the repository file.
- This resolves staging isolation and migration activation only. Provider, non-demo pilot, human UAT, operational-owner, and production gates remain closed.
