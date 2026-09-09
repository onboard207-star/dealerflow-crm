# Vehicle Intelligence Bridge

**Assessment date:** September 8, 2026  
**Gate:** PILOT-P1-02  
**Status:** Catalog projection and first controlled isolated-staging match accepted; remaining negative and cross-role UI checks pending

## Boundary

DealerFlow keeps reference knowledge and physical dealership inventory separate.

- Catalog authority: Make → Model → Model Year → Trim → Configuration → colors, packages, features, and specifications.
- Physical authority: Vehicle/VIN → Inventory Unit/stock cycle → location, pricing, media, and status.
- A tenant-owned Vehicle can have one explicitly verified current match to a catalog Configuration. The match records evidence and actor provenance; it never changes VIN or Inventory authority.
- Catalog records cannot supply or imply VIN, stock number, physical availability, dealership price, Organization, or Location.
- Airtable record IDs may be retained only as source provenance. Deterministic DealerFlow IDs are derived from declared stable source keys and entity kind.

## Source inventory and quality

The connected `DealerFlow AI Vehicle & Inventory` source currently exposes separate Make, Model, Model Year, Trim, Trim Configuration, exterior eligibility, interior eligibility, color-rule, Feature, Package & Option, Specification, Inventory Unit, comparison, OEM paint, and OEM interior tables.

Observed source strengths:

- Makes and Models use explicit stable business keys such as `OEM-HONDA` and `MODEL-HONDA-CRV`.
- Trim Configurations use explicit stable keys such as `CFG-HONDA-CRV-2026-SPORTL-HYBRID-AWD-ECVT`.
- Configuration records contain useful drivetrain, powertrain, engine, transmission, body, seating, and relationship data.
- Source and readiness fields distinguish OEM-verified, dealer-verified, in-progress, needs-review, pilot-ready, and non-applicable records.

Observed acceptance risks:

- Configuration readiness is mixed; sampled records include `In Progress`, `Needs Review`, `Not Applicable`, and unset values as well as verified source status.
- A verified source label is not equivalent to pilot-ready completeness. Completeness and relationship reconciliation must be evaluated independently.
- Source links must resolve through stable business keys. Airtable link/record IDs cannot cross the runtime authority boundary.
- Physical Inventory Units in the source must not be projected through the catalog importer. Existing PostgreSQL Vehicle and Inventory services remain authoritative.

## Runtime projection

Migration `0054_vehicle_intelligence_catalog` adds:

- Versioned catalog release manifests with source revision, content hash, record counts, and acceptance status.
- Global Make, Model, Model Year, Trim, and Configuration entities with stable DealerFlow IDs and record-level provenance hashes.
- One typed attribute authority for exterior colors, interior colors, features, packages, and specifications, plus explicit Configuration relationships and conditions.
- Tenant-isolated Vehicle-to-Configuration match evidence with at most one verified match per Vehicle.
- Read-only catalog access for application runtimes and an explicit `app.vehicle_catalog_import=enabled` write boundary for governed import execution.
- A pure Airtable snapshot extractor that resolves provider links into stable DealerFlow keys before projection, plus an atomic PostgreSQL projector that locks each source dataset, stages a release, upserts canonical nodes, replaces explicit relationships, and publishes only on transaction success.
- Historical release manifests support reproducible supersession and rollback inputs. Exact manifest replay returns the existing release rather than duplicating it.
- Evidence-backed Vehicle matching requires Inventory update authority, rooftop access, an eligible verified/pilot-ready Configuration, and normalized year/make/model agreement. Conflicts fail closed.

The application validator rejects duplicate keys, unresolved parents, Airtable IDs used as stable authority, source mismatch, and physical-inventory fields in catalog content. It derives the same canonical ID across repeat projections even when a provenance record ID changes.

## Reconciliation and failure handling

Before a release can become accepted:

1. Validate all stable keys, parent links, attribute links, and record hashes.
2. Classify every source record by readiness; unset readiness fails closed as `needs-review`.
3. Reconcile counts by entity kind and retain the manifest hash and source revision.
4. Reject the release atomically on missing parents, duplicate stable keys, invalid relationships, or forbidden physical fields.
5. Permit verified Vehicle matches only to configurations classified `verified` or `pilot-ready` after human/source evidence review.
6. Preserve the previous accepted release until the candidate passes reconciliation. Do not delete or mutate physical Vehicles or Inventory Units during catalog rollback.

## Remaining acceptance work

- Complete hands-on responsive Vehicle Intelligence review in a separately authenticated Salesperson browser session. Salesperson write denial is already verified through the authenticated application API.
- Record explicit human role-UAT approval before marking the overall pilot gate passed. The deterministic catalog, match, negative-authorization, and Manager/Inventory-capable acceptance checks are complete.

## Isolated-staging controlled match — September 9, 2026

- Runtime commit: `f24a767d7cac724771f4377489d7cfd8366d4dec`.
- Accepted Configuration: `vcf_79197e26b9c52b480a8d38d7a899ef15` / `CFG-HONDA-ACCORD-2026-LX-FWD-CVT` (`pilot-ready`).
- Governed fixture: Vehicle `veh_9b20bdf99f89a54695c799a40a9743c5`, Inventory Unit `inv_9b20bdf99f89a54695c799a40a9743c5`, test VIN `TESTCATALG26LX001`, stock `TEST-VI-LX-001`.
- Exact identity verification passed for 2026 / Honda / Accord / LX. The selected Configuration belongs to the canonical LX Trim and is eligible under the current readiness rules.
- The staging-only provisioner requires explicit confirmation and the exact isolated database host. First execution returned `created`; replay returned `existing` with the same deterministic IDs.
- The authenticated Manager selected the single exact candidate using the actual Vehicle Intelligence control. The workspace then displayed the configuration, readiness, powertrain, drivetrain, engine, transmission, colors, and highlights.
- Post-match inspection found exactly one match with four evidence fields. VIN, stock, price, color, location, ownership boundary, status/lifecycle, media, and delivery/sold state were not changed.
- Manager desktop and mobile-width UI checks passed. A wrong-tenant request failed without exposing the fixture.
- Production, existing accepted inventory, stock `NDB1FDB2`, and the accepted catalog release were not modified.
- Canonical match replay returned `200` twice with `created: false`; a different Configuration returned `409`; an authenticated Salesperson attempt returned `403`. The original Configuration remained authoritative.

## Simulation Run #1 checkpoint

- A clearly synthetic Lead/customer was created in the existing demo tenant and linked to stock `TEST-VI-LX-001`.
- The journey progressed through safe contact logging, qualification, confirmed appointment, showroom arrival/check-in/start/completion, and Deal `DF-0432892E`.
- Founder-approved simulation price `$28,395` was recorded only on immutable Quote versions; the physical Inventory Unit price remained unset. No other pricing or finance value was inferred.
- Quote v2 was requested by an authenticated Salesperson and approved by a distinct authenticated General Manager after Salesperson self-approval returned `403`. The customer-safe proposal passed privacy review, exact v2 acceptance succeeded, and alternate v1 acceptance returned `409`.
- The Deal progressed through approval, contracting, required-document completion, delivery readiness, scheduled/ready/completed delivery, final delivered state, and post-delivery follow-up visibility.
- The Customer workspace visibly reconciles the accepted Quote, completed documents, completed delivery, sold Lead, follow-up task, and chronological timeline. No P0/P1 application defect was found during this continuation.
