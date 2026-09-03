CREATE TABLE "inventory_cost_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "inventory_unit_id" text NOT NULL,
  "cost_cents" integer NOT NULL,
  "source_type" text NOT NULL,
  "source_label" text NOT NULL,
  "source_reference" text,
  "effective_at" timestamptz NOT NULL,
  "captured_at" timestamptz DEFAULT now() NOT NULL,
  "captured_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_cost_snapshots_inventory_fk" FOREIGN KEY ("organization_id","location_id","inventory_unit_id") REFERENCES "inventory_units"("organization_id","location_id","id"),
  CONSTRAINT "inventory_cost_snapshots_id_format" CHECK ("id" ~ '^ics_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "inventory_cost_snapshots_cost_nonnegative" CHECK ("cost_cents" >= 0),
  CONSTRAINT "inventory_cost_snapshots_source_type" CHECK ("source_type" IN ('dms','accounting','invoice','acquisition','manual-documented')),
  CONSTRAINT "inventory_cost_snapshots_source_label" CHECK (length(trim("source_label")) BETWEEN 1 AND 200),
  CONSTRAINT "inventory_cost_snapshots_source_reference" CHECK ("source_reference" IS NULL OR length(trim("source_reference")) BETWEEN 1 AND 500)
);
CREATE UNIQUE INDEX "inventory_cost_snapshots_org_id_unique" ON "inventory_cost_snapshots" ("organization_id","id");
CREATE INDEX "inventory_cost_snapshots_unit_effective_idx" ON "inventory_cost_snapshots" ("organization_id","inventory_unit_id","effective_at" DESC);

CREATE TABLE "quote_pack_policies" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text,
  "enabled" boolean DEFAULT false NOT NULL,
  "pack_amount_cents" integer,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updated_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_pack_policies_location_fk" FOREIGN KEY ("organization_id","location_id") REFERENCES "locations"("organization_id","id"),
  CONSTRAINT "quote_pack_policies_id_format" CHECK ("id" ~ '^qpk_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_pack_policies_version_positive" CHECK ("version" > 0),
  CONSTRAINT "quote_pack_policies_amount" CHECK (("enabled" = false AND "pack_amount_cents" IS NULL) OR ("enabled" = true AND "pack_amount_cents" IS NOT NULL AND "pack_amount_cents" >= 0))
);
CREATE UNIQUE INDEX "quote_pack_policies_org_id_unique" ON "quote_pack_policies" ("organization_id","id");
CREATE UNIQUE INDEX "quote_pack_policies_scope_unique" ON "quote_pack_policies" ("organization_id",COALESCE("location_id",''));

CREATE TABLE "quote_profitability_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "inventory_unit_id" text NOT NULL,
  "inventory_cost_snapshot_id" text NOT NULL,
  "pack_policy_id" text,
  "vehicle_sell_cents" integer NOT NULL,
  "vehicle_cost_cents" integer NOT NULL,
  "pack_cents" integer DEFAULT 0 NOT NULL,
  "front_gross_cents" integer NOT NULL,
  "backend_gross_cents" integer NOT NULL,
  "total_gross_cents" integer NOT NULL,
  "captured_at" timestamptz DEFAULT now() NOT NULL,
  "captured_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "quote_profitability_quote_fk" FOREIGN KEY ("organization_id","quote_id") REFERENCES "deal_quotes"("organization_id","id"),
  CONSTRAINT "quote_profitability_inventory_fk" FOREIGN KEY ("organization_id","location_id","inventory_unit_id") REFERENCES "inventory_units"("organization_id","location_id","id"),
  CONSTRAINT "quote_profitability_cost_fk" FOREIGN KEY ("organization_id","inventory_cost_snapshot_id") REFERENCES "inventory_cost_snapshots"("organization_id","id"),
  CONSTRAINT "quote_profitability_pack_fk" FOREIGN KEY ("organization_id","pack_policy_id") REFERENCES "quote_pack_policies"("organization_id","id"),
  CONSTRAINT "quote_profitability_id_format" CHECK ("id" ~ '^qpf_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_profitability_amounts" CHECK ("vehicle_sell_cents" >= 0 AND "vehicle_cost_cents" >= 0 AND "pack_cents" >= 0),
  CONSTRAINT "quote_profitability_front_math" CHECK ("front_gross_cents" = "vehicle_sell_cents" - "vehicle_cost_cents" - "pack_cents"),
  CONSTRAINT "quote_profitability_total_math" CHECK ("total_gross_cents" = "front_gross_cents" + "backend_gross_cents")
);
CREATE UNIQUE INDEX "quote_profitability_org_id_unique" ON "quote_profitability_snapshots" ("organization_id","id");
CREATE UNIQUE INDEX "quote_profitability_quote_unique" ON "quote_profitability_snapshots" ("organization_id","quote_id");

ALTER TABLE "inventory_cost_snapshots" ENABLE ROW LEVEL SECURITY; ALTER TABLE "inventory_cost_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inventory_cost_snapshots_tenant_select" ON "inventory_cost_snapshots" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "inventory_cost_snapshots_tenant_insert" ON "inventory_cost_snapshots" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));
ALTER TABLE "quote_pack_policies" ENABLE ROW LEVEL SECURITY; ALTER TABLE "quote_pack_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_pack_policies_tenant_all" ON "quote_pack_policies" FOR ALL USING ("organization_id"=nullif(current_setting('app.organization_id',true),'')) WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));
ALTER TABLE "quote_profitability_snapshots" ENABLE ROW LEVEL SECURITY; ALTER TABLE "quote_profitability_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_profitability_tenant_select" ON "quote_profitability_snapshots" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "quote_profitability_tenant_insert" ON "quote_profitability_snapshots" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION prevent_inventory_cost_snapshot_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Inventory cost snapshots are immutable'; END $$;
CREATE TRIGGER "inventory_cost_snapshots_immutable" BEFORE UPDATE OR DELETE ON "inventory_cost_snapshots" FOR EACH ROW EXECUTE FUNCTION prevent_inventory_cost_snapshot_rewrite();
CREATE FUNCTION prevent_quote_profitability_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Quote profitability snapshots are immutable'; END $$;
CREATE TRIGGER "quote_profitability_immutable" BEFORE UPDATE OR DELETE ON "quote_profitability_snapshots" FOR EACH ROW EXECUTE FUNCTION prevent_quote_profitability_rewrite();
