CREATE TYPE "trade_appraisal_status" AS ENUM ('draft','presented','accepted','rejected','expired','acquired');
CREATE TYPE "delivery_status" AS ENUM ('scheduled','ready','completed','cancelled');
ALTER TYPE "vehicle_interest_status" ADD VALUE 'traded';
CREATE UNIQUE INDEX "deals_organization_location_id_unique" ON "deals" ("organization_id", "location_id", "id");

CREATE TABLE "trade_appraisals" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "deal_id" text NOT NULL, "vehicle_id" text NOT NULL,
  "version" integer NOT NULL, "status" "trade_appraisal_status" DEFAULT 'draft' NOT NULL,
  "allowance_cents" integer NOT NULL, "payoff_cents" integer NOT NULL, "equity_cents" integer NOT NULL,
  "odometer_miles" integer, "condition_notes" text, "lienholder" text, "expires_at" timestamptz,
  "acquired_inventory_unit_id" text, "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL, "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "trade_appraisals_same_organization_deal_fk" FOREIGN KEY ("organization_id", "deal_id") REFERENCES "deals"("organization_id", "id"),
  CONSTRAINT "trade_appraisals_same_organization_vehicle_fk" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id"),
  CONSTRAINT "trade_appraisals_inventory_matches_vehicle_fk" FOREIGN KEY ("organization_id", "vehicle_id", "acquired_inventory_unit_id") REFERENCES "inventory_units"("organization_id", "vehicle_id", "id"),
  CONSTRAINT "trade_appraisals_id_format" CHECK ("id" ~ '^tap_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "trade_appraisals_version_positive" CHECK ("version" > 0),
  CONSTRAINT "trade_appraisals_equity_consistent" CHECK ("equity_cents" = "allowance_cents" - "payoff_cents"),
  CONSTRAINT "trade_appraisals_amounts_nonnegative" CHECK ("allowance_cents" >= 0 and "payoff_cents" >= 0),
  CONSTRAINT "trade_appraisals_odometer_nonnegative" CHECK ("odometer_miles" is null or "odometer_miles" >= 0),
  CONSTRAINT "trade_appraisals_notes_length" CHECK ("condition_notes" is null or char_length("condition_notes") <= 2000)
);
CREATE UNIQUE INDEX "trade_appraisals_organization_id_unique" ON "trade_appraisals" ("organization_id", "id");
CREATE UNIQUE INDEX "trade_appraisals_deal_vehicle_version_unique" ON "trade_appraisals" ("organization_id", "deal_id", "vehicle_id", "version");
CREATE UNIQUE INDEX "trade_appraisals_organization_idempotency_unique" ON "trade_appraisals" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "trade_appraisals_one_accepted_unique" ON "trade_appraisals" ("organization_id", "deal_id", "vehicle_id") WHERE "status" in ('accepted','acquired');

CREATE TABLE "trade_appraisal_status_events" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "appraisal_id" text NOT NULL,
  "from_status" "trade_appraisal_status", "to_status" "trade_appraisal_status" NOT NULL, "reason" text,
  "idempotency_key" text NOT NULL, "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "trade_status_events_same_organization_appraisal_fk" FOREIGN KEY ("organization_id", "appraisal_id") REFERENCES "trade_appraisals"("organization_id", "id"),
  CONSTRAINT "trade_status_events_id_format" CHECK ("id" ~ '^tas_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "trade_status_events_changed" CHECK ("from_status" is null or "from_status" <> "to_status")
);
CREATE UNIQUE INDEX "trade_status_events_organization_id_unique" ON "trade_appraisal_status_events" ("organization_id", "id");
CREATE UNIQUE INDEX "trade_status_events_organization_idempotency_unique" ON "trade_appraisal_status_events" ("organization_id", "idempotency_key");

CREATE TABLE "deal_deliveries" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "location_id" text NOT NULL, "deal_id" text NOT NULL,
  "status" "delivery_status" DEFAULT 'scheduled' NOT NULL, "starts_at" timestamptz NOT NULL, "ends_at" timestamptz NOT NULL,
  "timezone" text NOT NULL, "notes" text, "completed_at" timestamptz, "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL, "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "deal_deliveries_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "deal_deliveries_same_location_deal_fk" FOREIGN KEY ("organization_id", "location_id", "deal_id") REFERENCES "deals"("organization_id", "location_id", "id"),
  CONSTRAINT "deal_deliveries_id_format" CHECK ("id" ~ '^dlv_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deal_deliveries_time_order" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "deal_deliveries_completion_consistent" CHECK (("status" = 'completed') = ("completed_at" is not null)),
  CONSTRAINT "deal_deliveries_notes_length" CHECK ("notes" is null or char_length("notes") <= 2000)
);
CREATE UNIQUE INDEX "deal_deliveries_organization_id_unique" ON "deal_deliveries" ("organization_id", "id");
CREATE UNIQUE INDEX "deal_deliveries_deal_unique" ON "deal_deliveries" ("organization_id", "deal_id");
CREATE UNIQUE INDEX "deal_deliveries_organization_idempotency_unique" ON "deal_deliveries" ("organization_id", "idempotency_key");
CREATE INDEX "deal_deliveries_location_start_idx" ON "deal_deliveries" ("organization_id", "location_id", "starts_at");

CREATE TABLE "deal_delivery_status_events" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "delivery_id" text NOT NULL,
  "from_status" "delivery_status", "to_status" "delivery_status" NOT NULL, "reason" text,
  "idempotency_key" text NOT NULL, "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "delivery_status_events_same_organization_delivery_fk" FOREIGN KEY ("organization_id", "delivery_id") REFERENCES "deal_deliveries"("organization_id", "id"),
  CONSTRAINT "delivery_status_events_id_format" CHECK ("id" ~ '^dse_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "delivery_status_events_changed" CHECK ("from_status" is null or "from_status" <> "to_status")
);
CREATE UNIQUE INDEX "delivery_status_events_organization_id_unique" ON "deal_delivery_status_events" ("organization_id", "id");
CREATE UNIQUE INDEX "delivery_status_events_organization_idempotency_unique" ON "deal_delivery_status_events" ("organization_id", "idempotency_key");

ALTER TABLE "trade_appraisals" ENABLE ROW LEVEL SECURITY; ALTER TABLE "trade_appraisals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "trade_appraisals_current_tenant_select" ON "trade_appraisals" FOR SELECT USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "trade_appraisals_current_tenant_insert" ON "trade_appraisals" FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "trade_appraisals_current_tenant_update" ON "trade_appraisals" FOR UPDATE USING (organization_id = current_setting('app.organization_id', true)) WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE FUNCTION prevent_trade_appraisal_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.organization_id, NEW.deal_id, NEW.vehicle_id, NEW.version, NEW.allowance_cents, NEW.payoff_cents, NEW.equity_cents, NEW.odometer_miles, NEW.condition_notes, NEW.lienholder, NEW.idempotency_key)
    IS DISTINCT FROM (OLD.organization_id, OLD.deal_id, OLD.vehicle_id, OLD.version, OLD.allowance_cents, OLD.payoff_cents, OLD.equity_cents, OLD.odometer_miles, OLD.condition_notes, OLD.lienholder, OLD.idempotency_key)
  THEN RAISE EXCEPTION 'Trade appraisal financial versions are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "trade_appraisals_immutable_financials" BEFORE UPDATE ON "trade_appraisals" FOR EACH ROW EXECUTE FUNCTION prevent_trade_appraisal_rewrite();
ALTER TABLE "trade_appraisal_status_events" ENABLE ROW LEVEL SECURITY; ALTER TABLE "trade_appraisal_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "trade_status_events_current_tenant_select" ON "trade_appraisal_status_events" FOR SELECT USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "trade_status_events_current_tenant_insert" ON "trade_appraisal_status_events" FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true));
ALTER TABLE "deal_deliveries" ENABLE ROW LEVEL SECURITY; ALTER TABLE "deal_deliveries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deal_deliveries_current_tenant_select" ON "deal_deliveries" FOR SELECT USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "deal_deliveries_current_tenant_insert" ON "deal_deliveries" FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "deal_deliveries_current_tenant_update" ON "deal_deliveries" FOR UPDATE USING (organization_id = current_setting('app.organization_id', true)) WITH CHECK (organization_id = current_setting('app.organization_id', true));
ALTER TABLE "deal_delivery_status_events" ENABLE ROW LEVEL SECURITY; ALTER TABLE "deal_delivery_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "delivery_status_events_current_tenant_select" ON "deal_delivery_status_events" FOR SELECT USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "delivery_status_events_current_tenant_insert" ON "deal_delivery_status_events" FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true));
