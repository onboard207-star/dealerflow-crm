# DealerFlow Recovery Runbook

## Purpose

This runbook separates application rollback from database recovery. It applies to controlled staging exercises and future approved production incidents. Never test restoration against the active production database.

## Backup evidence checklist

Record the provider, database identifier, environment, backup timestamp, backup type, retention, encryption status, responsible owner, and evidence link. Provider marketing or an enabled toggle is not proof of a recoverable backup.

Inventory media uses independent object storage. Record bucket versioning, lifecycle, deletion protection, and restore behavior separately from PostgreSQL.

## Isolated-staging recovery posture — September 11, 2026

- `dealerflow-isolated-staging-db` is a Render Managed PostgreSQL 18 primary in Virginia with 15 GB storage, no high availability, no read replicas, and no connection pool. It is available and connected only to the isolated staging application.
- Render Managed PostgreSQL supplies automatic daily logical backups. The exact retention window and point-in-time recovery entitlement depend on the database plan and must be confirmed in the database Recovery page before a pilot GO decision.
- A recovery drill must restore a selected snapshot to a newly created disposable database. Creating that billable recovery target requires explicit infrastructure/financial authorization. Active isolated staging and production are prohibited restore targets.
- The responsible operator is the DealerFlow technical launch owner. The pilot owner must independently review the evidence before marking recovery accepted.

The restore evidence package must include the source database ID, snapshot timestamp, disposable target ID, application commit, migration head/hashes, start and completion times, organization/location/relationship counts, RLS denial results, health/readiness results, recovery-point gap, recovery duration, approver, and cleanup decision. Credentials and connection strings must never appear in the evidence.

## Safe restore exercise

1. Select a known backup and record its timestamp before creating resources.
2. Restore to a new isolated database with no production web service or provider worker connected.
3. use the exact compatible application release and migration journal.
4. Run schema and readiness checks without enabling SMS, email, AI, storage mutation, or background sends.
5. Validate counts and representative relationships for organizations, locations, memberships, Customers, Leads, Inventory, Deals, communications, and audit logs.
6. Attempt cross-tenant reads under two tenant contexts and confirm denial.
7. Record elapsed restore time, estimated data-loss window, validation results, errors, and cleanup ownership.
8. Destroy the isolated restore only after evidence is retained and the responsible owner approves cleanup.

## Application rollback

1. Declare the incident and capture the failing release SHA and correlation IDs.
2. Stop risky feature flags or workers when that contains impact safely.
3. Confirm the previous immutable image is compatible with the current schema.
4. Redeploy the previous image without reversing migrations.
5. Run liveness, readiness, login, protected-worker, security-header, and authenticated core-workflow smoke checks.
6. Record the decision, approver, times, result, and remaining impact.

For isolated staging, auto-deploy remains disabled. Every candidate is manually promoted from the verified branch head. `node scripts/render-migrate.mjs` is the service pre-deploy command, so a failed migration prevents the new image from receiving traffic. The previous immutable deploy remains the application rollback target; migrations are forward-only unless an independently reviewed database recovery decision is made.

## Pilot monitoring and alert ownership

Render health checks `/api/health`; `/api/ready` separately verifies required runtime dependencies. Render metrics cover instance count, CPU, memory, HTTP status counts, and PostgreSQL connections. Application telemetry and the signed operational alert webhook cover durable-job and provider failures when the alert destination is configured.

| Condition | Severity | Owner | First response | Escalation | Resolution |
| --- | --- | --- | --- | --- | --- |
| Health check fails or instance count is zero | P0 | Technical launch owner | Inspect current deploy and runtime logs; freeze promotion | DealerFlow engineering owner | Stable health checks and authenticated smoke pass |
| Database unavailable or readiness fails | P0 | Technical launch owner | Stop write workflows and provider jobs; inspect database status/connections | Database recovery approver | Connectivity, schema, and representative relationship checks pass |
| Pre-deploy migration fails | P0 | Release operator | Do not promote; capture migration log and hash | Engineering owner | Corrected migration passes pre-deploy and schema reconciliation |
| Application 5xx burst or repeated unhandled exception | P1, P0 if core workflow unavailable | Technical launch owner | Correlate Render request ID, deploy, route, and logs | Engineering owner | Error rate returns to baseline and regression passes |
| Transactional email or outbound job reports failure | P1 | Communications owner | Pause replay if provider state is ambiguous; inspect sanitized job evidence | Engineering/provider owner | Provider state reconciled and idempotent replay succeeds |
| Webhook signature/processing failures | P1 | Communications owner | Preserve request correlation evidence; verify provider configuration | Security owner for signature failures | Valid callbacks process; invalid callbacks remain denied |
| Catalog import/projection failure | P1 | Inventory data owner | Leave accepted release active; inspect reconciliation manifest | Engineering owner | Governed replay succeeds without partial publication |
| Repeated authentication failure beyond expected user mistakes | P1 | Support owner | Verify account/invitation state and proxy-aware rate limiting | Security owner | Correct user access restored; invalid access still denied |

Expected `401`, `403`, and `409` authorization or lifecycle denials are not alerts by themselves. Alert only on a sustained abnormal pattern or evidence of abuse.

## Durable-job recovery

- Transactional email and outbound messaging claim bounded batches, persist attempt state, retry with backoff, reclaim stale `sending` work, record sanitized provider results, and use idempotency keys. Operators must reconcile provider state before replay when a send may have left DealerFlow.
- Vehicle catalog projection publishes atomically, retains accepted historical releases, reuses an identical manifest, and leaves the prior release active on failure.
- Import batches retain immutable staged rows, checksums, applied-record evidence, replay behavior, and controlled reversal for demo/pilot tenants.
- Job recovery evidence must record the job kind, record IDs (never message bodies or credentials), prior state, attempt count, correlation ID, provider ID if applicable, operator, replay time, final state, and duplicate-effect check.

## Controlled support drills

Use safe simulations before destructive infrastructure drills:

1. **Application unavailable:** verify Render health/instance/deploy signals and walk the immutable deploy rollback procedure without changing the live service.
2. **Database unavailable:** validate readiness failure behavior with a test double; a live outage drill requires a disposable application/database pair.
3. **Provider degraded:** use gateway failure tests and confirm queued/failed state plus sanitized alerts; never claim live provider failure evidence from a mock.
4. **Failed job:** exercise retry, stale-claim recovery, terminal failure, and idempotent replay in tests or controlled synthetic records.
5. **Migration failure:** a failing pre-deploy command must prevent promotion; verify on a disposable target before intentionally submitting a bad migration.
6. **User locked out:** use the supported invitation/password-reset flow, verify organization/location/role grants, and preserve invalid-credential denial.
7. **Bad deployment:** identify the last compatible immutable image, freeze jobs if required, roll back the app image, then run health/readiness/authenticated smoke checks.

## Database recovery

Treat data recovery as a separate reviewed operation. Prefer a forward repair for non-destructive schema defects. Restore only when data loss or corruption warrants it and the recovery point is understood. Never use an untested down migration or delete current data merely to match an older application image.

## Exit criteria

Recovery is complete only when the application starts, health checks pass, representative records and relationships are intact, tenant isolation is reconfirmed, provider workers are deliberately re-enabled, and the incident owner signs off.
