CREATE TYPE "deal_status" AS ENUM ('draft','working','pending-approval','approved','contracted','delivered','cancelled');
CREATE TYPE "purchase_type" AS ENUM ('cash','finance','lease');

CREATE UNIQUE INDEX "inventory_units_organization_vehicle_id_unique"
  ON "inventory_units" ("organization_id", "vehicle_id", "id");
CREATE UNIQUE INDEX "inventory_units_organization_location_vehicle_id_unique"
  ON "inventory_units" ("organization_id", "location_id", "vehicle_id", "id");

CREATE TABLE "deals" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "location_id" text NOT NULL,
  "customer_id" text NOT NULL, "lead_id" text NOT NULL, "primary_vehicle_id" text NOT NULL,
  "inventory_unit_id" text, "owner_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "deal_number" text NOT NULL, "status" "deal_status" DEFAULT 'draft' NOT NULL,
  "purchase_type" "purchase_type", "agreed_price_cents" integer, "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "deals_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "deals_same_lead_customer_fk" FOREIGN KEY ("organization_id", "customer_id", "lead_id") REFERENCES "leads"("organization_id", "customer_id", "id"),
  CONSTRAINT "deals_same_organization_vehicle_fk" FOREIGN KEY ("organization_id", "primary_vehicle_id") REFERENCES "vehicles"("organization_id", "id"),
  CONSTRAINT "deals_inventory_matches_location_vehicle_fk" FOREIGN KEY ("organization_id", "location_id", "primary_vehicle_id", "inventory_unit_id") REFERENCES "inventory_units"("organization_id", "location_id", "vehicle_id", "id"),
  CONSTRAINT "deals_id_format" CHECK ("id" ~ '^dea_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deals_number_format" CHECK ("deal_number" ~ '^DF-[A-Z0-9]{8}$'),
  CONSTRAINT "deals_price_nonnegative" CHECK ("agreed_price_cents" is null or "agreed_price_cents" >= 0)
);
CREATE UNIQUE INDEX "deals_organization_id_unique" ON "deals" ("organization_id", "id");
CREATE UNIQUE INDEX "deals_organization_number_unique" ON "deals" ("organization_id", "deal_number");
CREATE UNIQUE INDEX "deals_organization_idempotency_unique" ON "deals" ("organization_id", "idempotency_key");
CREATE INDEX "deals_customer_status_idx" ON "deals" ("organization_id", "customer_id", "status");
CREATE INDEX "deals_lead_idx" ON "deals" ("organization_id", "lead_id");

CREATE TABLE "deal_status_events" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "deal_id" text NOT NULL,
  "from_status" "deal_status", "to_status" "deal_status" NOT NULL, "reason" text,
  "idempotency_key" text NOT NULL, "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "deal_status_events_same_organization_deal_fk" FOREIGN KEY ("organization_id", "deal_id") REFERENCES "deals"("organization_id", "id"),
  CONSTRAINT "deal_status_events_id_format" CHECK ("id" ~ '^dst_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deal_status_events_changed" CHECK ("from_status" is null or "from_status" <> "to_status"),
  CONSTRAINT "deal_status_events_reason_length" CHECK ("reason" is null or char_length("reason") <= 1000)
);
CREATE UNIQUE INDEX "deal_status_events_organization_id_unique" ON "deal_status_events" ("organization_id", "id");
CREATE UNIQUE INDEX "deal_status_events_organization_idempotency_unique" ON "deal_status_events" ("organization_id", "idempotency_key");
CREATE INDEX "deal_status_events_deal_time_idx" ON "deal_status_events" ("organization_id", "deal_id", "occurred_at");

ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deals_current_tenant_all" ON "deals" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
ALTER TABLE "deal_status_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deal_status_events_current_tenant_select" ON "deal_status_events" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "deal_status_events_current_tenant_insert" ON "deal_status_events" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

DROP POLICY "consent_events_current_tenant_all" ON "communication_consent_events";
CREATE POLICY "consent_events_current_tenant_select" ON "communication_consent_events" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "consent_events_current_tenant_insert" ON "communication_consent_events" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
