# DealerFlow Execution Blockers

## HG-STG-001 — Render environment identity resolved

Resolved on September 1, 2026. `dealerflow-isolated-staging` (`srv-dabk8d610ojc73ds3afg`) and `dealerflow-isolated-staging-db` (`dpg-dabjm5e1egvs73b1s92g-a`) are contained in Render environment `DealerFlow Staging` (`evm-dabjhoss728c73fhllk0`). Exact commit `028c198d226d1979ed539c671b0719410f8c0d33`, empty-database isolation, database connectivity, and migration `0039` were verified. The prior mixed/Production-labeled resources remain closed to mutation.

## DWI-PILOT-001 — External dependency

Backup evidence, monitoring destination, and named operational ownership are missing. Next: resolve `DEC-PILOT-001`, then run restore, alert, and support exercises under review.

## DWI-PILOT-004 — P1 staging reset failure

Exact code-only fix commit `715f3f9` is deployed to isolated staging and proves governed fixture context `pilot-demo-v1` is used instead of internal template version `v1`. The single authorized reset then failed closed because the dedicated maintenance identity lacks EXECUTE permission on `notification_recipient_is_active`. Rollback preserved every baseline count and wrote no reset-completed event; the transient maintenance login and credential are disabled and removed. Next: review the function's role in reset-time constraints/policies and add only the minimum required privilege through a reviewed migration before authorizing another reset.

## DWI-PILOT-003 — Provider

R2 and restricted AI staging configuration are incomplete; customer communication acceptance is tenant-specific. Next: provision and review R2 configuration, then run upload/reorder/remove and failure-path acceptance.

## DWI-PILOT-005 — Human gate

Launch, rollback, and support owners are unnamed. Next: authorized owner resolves `DEC-PILOT-001`.

## DWI-PILOT-006 — Review and tenant authorization

Pilot dry run still requires an explicitly authorized non-demo target tenant/operator. Exact-release staging and migration `0039` are now verified, but that does not authorize a real pilot tenant.

## DWI-PILOT-007 — Human UAT

Required-role UAT waits for reset tooling, pilot dry run, and authorized participants. Human acceptance may not be fabricated.
