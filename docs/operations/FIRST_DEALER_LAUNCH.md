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

The current repository implements the safe validation and preview authority only. Upload storage, persistent batches, authorized commit, reconciliation, and batch-owned reversal remain deferred. Therefore no real dealership file should be uploaded or imported yet.

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
4. Add persistent tenant-isolated implementation projects and import batches after the platform-implementation authority is modeled.
5. Build protected upload storage, parser limits, authorized commit, reconciliation, and batch reversal.
6. Rehearse fictional onboarding through those real workflows before onboarding a real dealer.

