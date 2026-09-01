# DealerFlow Production Cutover and Pilot Command

## Current decision

**NO-GO — production remains untouched.**

The repository release has no verified P0, but production cutover prerequisites are not complete. The authoritative machine-readable record is `config/pilot-launch-manifest.json`; `pnpm pilot:cutover:check` validates that its decision and feature posture cannot contradict the recorded evidence.

## Verified release candidate

- Candidate commit: `856c7a02284588330128c332cdb48db0f3fc2be0`
- Database schema: `0038_organization_data_class`
- Candidate status: staging only; not tagged or approved for production
- Synthetic acceptance tenant: demo-class staging data only; never eligible for production promotion

This commit is a reference candidate, not a frozen production release. A final candidate must be rebuilt and revalidated after every blocker-closing change.

## Open launch gates

The following prevent deploy-dark and every later cutover phase:

1. Resolve every pilot-blocking P1 and rerun the exact-release golden journeys.
2. Prove provider-degraded behavior with approved pilot configuration.
3. Prove reset/reseed or snapshot restoration acceptance in staging.
4. Capture a current backup and complete an isolated restore drill.
5. Inventory production directly, including deploy target, database, queues, storage, secrets, providers, jobs, webhooks, flags, kill switches, monitoring, backups, domains, and exact release IDs.
6. Compare production and staging schema/config contracts and document intentional differences.
7. Approve the pilot tenant, rooftops, users, roles, modules, providers, dates, success metrics, exclusions, support contact, launch owner, and rollback owner.
8. Run role acceptance, mobile checks, external uptime checks, and an alert-delivery/on-call drill.

Unknown production values remain `null`, empty, or `not_verified` in the manifest. They must not be copied from staging or invented.

## Default feature posture

All high-impact capabilities listed in the manifest remain off. This includes autonomous sends, bulk or destructive AI writes, recording, billing, lender/credit submission, e-signature, DMS posting, autonomous pricing, reseller activation, experimentation, and automated review solicitation. Enabling one requires separate scope approval, provider acceptance, a safe test destination where relevant, and an audited rollback switch.

## Ordered cutover after human GO

The authorized launch owner—not CI, AI, or Codex—must record GO with identity and timestamp only after all gates are verified.

1. Activate change freeze and capture the pre-cutover backup evidence.
2. Freeze/tag the exact release candidate and record artifact and configuration versions.
3. Deploy backward-compatible code dark with pilot flags disabled.
4. Validate health, readiness, release identity, security headers, and database compatibility.
5. Apply approved expand/backfill migrations and reconcile immediately.
6. Enable only the approved tenant, rooftop, modules, and flags.
7. Provision only approved named users; verify rooftop and role boundaries.
8. Activate providers one channel at a time after synthetic and failure checks.
9. Run production-safe smoke using approved test records and destinations.
10. Start the hypercare cadence and publish the internal pilot-start notice.

Stop on unexpected migration divergence, tenant-scope failure, authorization failure, missing production dependency, unsafe provider behavior, failed smoke, or unavailable rollback evidence.

## Rollback levels

Use the least disruptive safe containment: feature disable, provider disable, tenant maintenance/pause, application rollback to a schema-compatible immutable release, reviewed database forward-fix/restore, or full pilot pause. After containment, reconcile canonical data, queued jobs, callbacks, access, and duplicate side effects before resuming.

Immediate rollback or pause triggers include cross-tenant exposure, unauthorized privileged access, unrecoverable corruption, critical migration divergence, broad authentication outage, sustained critical errors, unsafe outbound communication, or failure to recover a core workflow inside the approved window.

## Hypercare evidence

Launch-day and first-week reviews must record release, tenant, active meaningful workflows, provider and queue health, incidents, support cases, data-quality exceptions, rollback posture, owners, decisions, and evidence links. Synthetic/demo activity must remain excluded from pilot adoption and business outcomes.

Hypercare exit requires no open P0, no unstable pilot-blocking P1, stable core workflows, accepted provider health, proven monitoring and recovery, controlled data quality, named support ownership, and documented limitations. First login alone never authorizes expansion.

## Evidence package

Retain the manifest, human GO decision, exact release/tag/artifact, migration output, reconciliation, role smoke, provider checks, alert drill, backup and restore proof, screenshots, incidents, rollback tests, daily reviews, and end-of-week recommendation. Do not claim production readiness or compliance from intended controls without this evidence.
