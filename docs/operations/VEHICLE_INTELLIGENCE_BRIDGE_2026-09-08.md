# Vehicle Intelligence Bridge

**Assessment date:** September 8, 2026  
**Gate:** PILOT-P1-02  
**Status:** Governed extractor/projector implemented locally; source acceptance and staging migration pending

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

- Complete full-source extraction and relationship QA, including all paginated records and linked color/package/feature/specification rows.
- Produce a reconciliation report with source/projected counts, missing relationships, duplicate stable keys, readiness distribution, and hashes.
- Apply migration `0054` only to authorized isolated staging, then validate forced RLS and importer refusal without its explicit context.
- Match controlled synthetic Vehicles to accepted configurations and verify tenant/location behavior without changing the accepted Lead-to-Delivered journey.
- Complete responsive and role-based runtime acceptance before marking PILOT-P1-02 passed.

No migration, source write, staging deployment, production action, or physical Inventory mutation was performed by this local foundation batch.
