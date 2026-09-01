# DealerFlow Execution Blockers

## HG-STG-001 — Ambiguous Render environment identity

The staging-named service reports `APP_ENV=staging`, but Render places the service/database under an environment labeled `Production`, and the database contains an active production-class tenant. No deployment, migration, seed/reset, or import is permitted there under the staging authorization packet. Next: provision or designate an isolated Render Staging environment/database containing no production-class tenant data and provide its resource identifiers.

## DWI-PILOT-001 — External dependency

Backup evidence, monitoring destination, and named operational ownership are missing. Next: resolve `DEC-PILOT-001`, then run restore, alert, and support exercises under review.

## DWI-PILOT-003 — Provider

R2 and restricted AI staging configuration are incomplete; customer communication acceptance is tenant-specific. Next: provision and review R2 configuration, then run upload/reorder/remove and failure-path acceptance.

## DWI-PILOT-005 — Human gate

Launch, rollback, and support owners are unnamed. Next: authorized owner resolves `DEC-PILOT-001`.

## DWI-PILOT-006 — Review and tenant authorization

Pilot dry run requires an explicitly authorized target tenant/operator and deployment of the exact release containing migration `0039`.

## DWI-PILOT-007 — Human UAT

Required-role UAT waits for reset tooling, pilot dry run, and authorized participants. Human acceptance may not be fabricated.
