# DealerFlow First Dealer Launch

## Current decision

DealerFlow remains **NOT PILOT READY**. A signed or interested dealership must not be represented as launchable until every mandatory gate in [Pilot Readiness](PILOT_READINESS.md) is verified. Riverside Honda Demo Pilot is a requested fictional simulation name only; no approved pilot, sponsor, champion, customer data, training completion, acceptance result, or launch decision has been created.

## Repeatable implementation lifecycle

Every implementation follows the same phases:

Discovery → Configuration → Data Preparation → Integration Setup → User Provisioning → Training → Acceptance Testing → Ready for Launch → Launch → Hypercare → Pilot Review → Complete.

Each phase is Not Started, In Progress, Blocked, or Verified. Percent complete is informational. It cannot override an unverified mandatory gate, open P0/P1 defect, or missing dealership GO decision.

## Import authority

DealerFlow uses one preview-first import contract for Customer/Lead, Inventory, and User preparation:

Upload → Parse → Validate → Preview → Map → Dry Run → Import → Reconcile → Complete.

The current repository implements safe validation plus tenant-isolated persistent staging. An authorized administrator can stage bounded JSON rows through the organization import API. DealerFlow records a SHA-256 source checksum, immutable normalized row evidence, mapping provenance, duplicate/review quarantine, idempotency, and an audit event. Existing canonical customer, inventory, and tenant-user identities are checked before a batch can become ready.

Authorized canonical commit, reconciliation, batch-owned reversal, and protected raw-file upload storage remain deferred. A `ready` batch means its staged rows passed validation; it does not mean production records were created. Therefore real dealership files must not be represented as migrated or reconciled yet.

Preview behavior:

- Only documented canonical fields may be mapped. Unknown source columns go to review or rejection; they never create production fields.
- Customer identity is normalized by email and E.164 phone. Deterministic matches are labeled duplicates; ambiguous records are never merged automatically.
- Inventory keeps a physical unit separate from catalog configuration. Missing VIN is an explicit review condition and is never fabricated.
- User preparation requires an explicit approved canonical role key. Job-title text cannot grant elevated access.
- Existing and within-batch identity keys are checked before any future commit stage.

## Launch gate

Required gates are Security, Tenant Isolation, Authorization, Backup, Restore, Monitoring, Provider Behavior, Core Workflow, Mobile, Pilot Data, Training, Acceptance, and Support. Launch also requires an explicit dealership GO decision and no open P0/P1 defect.

Launch activation, customer communications, billing activation, and production deployment are separate authorized actions. Technical onboarding does not authorize any of them.

## First-pilot scope

The recommended initial scope remains Sales, BDC, Sales Management, Inventory, and Vehicle Workspace. Finance, Recon, Service, cross-tenant Platform Administration, and billing are excluded until independently ready.

## Next implementation dependencies

1. Resolve staging runtime configuration readiness.
2. Complete the backup and isolated restore exercise.
3. Configure external monitoring, alert ownership, and support escalation.
4. Add persistent tenant-isolated implementation projects and connect staged import batches to their launch gates.
5. Build protected raw-file upload storage, authorized canonical commit, reconciliation, and batch reversal.
6. Rehearse fictional onboarding through those real workflows before onboarding a real dealer.

## Clean-room synthetic rehearsal

The canonical provisioner supports an explicitly classified demo tenant through `--data-class demo --confirm SYNTHETIC-DEMO`. This is the only supported path for the clean-room rehearsal. It creates deterministic Organization, configuration, rooftop, system roles/capabilities, immutable audit evidence, and an Owner invitation; retry must reconcile the same identities or fail on a conflict.

After provisioning, the existing dealership template may seed only an active `data_class=demo` Organization. The staging identity provisioner may invite the minimum Owner, Sales Manager, and Salesperson identities through Better Auth and canonical organization/location role grants. Synthetic physical inventory must use the governed template/import path and `TEST` identity conventions. Airtable record IDs never become runtime authority.

Clean-room acceptance requires:

- invitation-based authentication for the three pilot roles;
- exact organization, rooftop, membership, role, and location verification;
- catalog reads from the accepted shared catalog with tenant-scoped physical inventory;
- a minimal Lead → Customer → Vehicle Interest → Appointment → Showroom → Deal → Quote → Manager Approval → exact-version acceptance journey;
- bilateral wrong-tenant denial against the existing simulation tenant;
- idempotent replay, conflicting-input refusal, and retained audit evidence;
- a documented cleanup plan that does not delete accepted evidence without approval.

Provisioning and deterministic seeding do not activate communications, billing, production, or a real dealership. Authentication remains a human gate because passwords and one-time setup links must not be committed or printed into operational evidence.
