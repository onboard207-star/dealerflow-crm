# DealerFlow Execution Blockers

## HG-STG-001 — Render environment identity resolved

Resolved on September 1, 2026. `dealerflow-isolated-staging` (`srv-dabk8d610ojc73ds3afg`) and `dealerflow-isolated-staging-db` (`dpg-dabjm5e1egvs73b1s92g-a`) are contained in Render environment `DealerFlow Staging` (`evm-dabjhoss728c73fhllk0`). Exact commit `028c198d226d1979ed539c671b0719410f8c0d33`, empty-database isolation, database connectivity, and migration `0039` were verified. The prior mixed/Production-labeled resources remain closed to mutation.

## DWI-PILOT-001 — External dependency

Backup evidence, monitoring destination, and named operational ownership are missing. Next: resolve `DEC-PILOT-001`, then run restore, alert, and support exercises under review.

## DWI-PILOT-004 — P1 staging reset failure

The exact-release synthetic seed reconciled successfully in isolated staging, but the guarded reset failed transactionally because `deals` are deleted before referencing `deal_status_events`. PostgreSQL enforced `deal_status_events_same_organization_deal_fk`; rollback preserved all fixture counts and no reset-completed audit event was written. Next: repair and regression-test deterministic reset deletion order without weakening constraints or tenant guards, deploy the reviewed fix, and rerun the single guarded reset.

## DWI-PILOT-003 — Provider

R2 and restricted AI staging configuration are incomplete; customer communication acceptance is tenant-specific. Next: provision and review R2 configuration, then run upload/reorder/remove and failure-path acceptance.

## DWI-PILOT-005 — Human gate

Launch, rollback, and support owners are unnamed. Next: authorized owner resolves `DEC-PILOT-001`.

## DWI-PILOT-006 — Review and tenant authorization

Pilot dry run still requires an explicitly authorized non-demo target tenant/operator. Exact-release staging and migration `0039` are now verified, but that does not authorize a real pilot tenant.

## DWI-PILOT-007 — Human UAT

Required-role UAT waits for reset tooling, pilot dry run, and authorized participants. Human acceptance may not be fabricated.
