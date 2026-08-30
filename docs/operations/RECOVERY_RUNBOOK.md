# DealerFlow Recovery Runbook

## Purpose

This runbook separates application rollback from database recovery. It applies to controlled staging exercises and future approved production incidents. Never test restoration against the active production database.

## Backup evidence checklist

Record the provider, database identifier, environment, backup timestamp, backup type, retention, encryption status, responsible owner, and evidence link. Provider marketing or an enabled toggle is not proof of a recoverable backup.

Inventory media uses independent object storage. Record bucket versioning, lifecycle, deletion protection, and restore behavior separately from PostgreSQL.

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

## Database recovery

Treat data recovery as a separate reviewed operation. Prefer a forward repair for non-destructive schema defects. Restore only when data loss or corruption warrants it and the recovery point is understood. Never use an untested down migration or delete current data merely to match an older application image.

## Exit criteria

Recovery is complete only when the application starts, health checks pass, representative records and relationships are intact, tenant isolation is reconfirmed, provider workers are deliberately re-enabled, and the incident owner signs off.

