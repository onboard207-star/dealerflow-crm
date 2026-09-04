ALTER TABLE "inventory_cost_snapshots" DISABLE TRIGGER "inventory_cost_snapshots_immutable";

ALTER TABLE "inventory_cost_snapshots"
  ADD COLUMN "version" integer,
  ADD COLUMN "previous_snapshot_id" text;

WITH ranked AS (
  SELECT "organization_id", "id", "inventory_unit_id",
    row_number() OVER (
      PARTITION BY "organization_id", "inventory_unit_id"
      ORDER BY "effective_at", "captured_at", "id"
    )::integer AS "version",
    lag("id") OVER (
      PARTITION BY "organization_id", "inventory_unit_id"
      ORDER BY "effective_at", "captured_at", "id"
    ) AS "previous_snapshot_id"
  FROM "inventory_cost_snapshots"
)
UPDATE "inventory_cost_snapshots" AS snapshot
SET "version" = ranked."version",
    "previous_snapshot_id" = ranked."previous_snapshot_id"
FROM ranked
WHERE snapshot."organization_id" = ranked."organization_id"
  AND snapshot."id" = ranked."id";

ALTER TABLE "inventory_cost_snapshots"
  ALTER COLUMN "version" SET DEFAULT 1,
  ALTER COLUMN "version" SET NOT NULL,
  ADD CONSTRAINT "inventory_cost_snapshots_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "inventory_cost_snapshots_previous_fk"
    FOREIGN KEY ("organization_id", "previous_snapshot_id")
    REFERENCES "inventory_cost_snapshots"("organization_id", "id") ON DELETE RESTRICT;

CREATE UNIQUE INDEX "inventory_cost_snapshots_unit_version_unique"
  ON "inventory_cost_snapshots" ("organization_id", "inventory_unit_id", "version");

ALTER TABLE "inventory_cost_snapshots"
  DROP CONSTRAINT "inventory_cost_snapshots_source_type",
  ADD CONSTRAINT "inventory_cost_snapshots_source_type" CHECK (
    "source_type" IN (
      'manual-verified',
      'dms-import',
      'accounting-import',
      'oem-invoice',
      'migration-import',
      'dms',
      'accounting',
      'invoice',
      'acquisition',
      'manual-documented'
    )
  );

ALTER TABLE "inventory_cost_snapshots" ENABLE TRIGGER "inventory_cost_snapshots_immutable";

-- Reconcile existing tenant-owned system roles with the governed default profile.
-- Runtime authorization continues to evaluate capabilities, never role names.
INSERT INTO "role_capabilities" ("role_id", "organization_id", "capability")
SELECT role.id, role.organization_id, grant_record.capability
FROM roles role
JOIN (VALUES
  ('owner', 'inventory.cost.read'), ('owner', 'inventory.cost.manage'),
  ('owner', 'quote.pack.read'), ('owner', 'quote.pack.configure'),
  ('general-manager', 'inventory.cost.read'), ('general-manager', 'inventory.cost.manage'),
  ('general-manager', 'quote.pack.read'), ('general-manager', 'quote.pack.configure'),
  ('sales-manager', 'inventory.cost.read'), ('sales-manager', 'quote.pack.read'),
  ('finance-manager', 'inventory.cost.read'), ('finance-manager', 'quote.pack.read'),
  ('inventory-manager', 'inventory.cost.read'), ('inventory-manager', 'inventory.cost.manage'),
  ('inventory-manager', 'quote.pack.read'),
  ('controller', 'inventory.cost.read'), ('controller', 'inventory.cost.manage'),
  ('controller', 'quote.pack.read'), ('controller', 'quote.pack.configure')
) AS grant_record(role_key, capability) ON grant_record.role_key = role.key
WHERE role.system = true
ON CONFLICT (role_id, capability) DO NOTHING;
