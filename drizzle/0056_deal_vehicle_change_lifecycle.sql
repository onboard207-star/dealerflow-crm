CREATE TABLE "deal_vehicle_change_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "deal_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "lead_id" text NOT NULL,
  "from_vehicle_id" text NOT NULL,
  "from_inventory_unit_id" text,
  "to_vehicle_id" text NOT NULL,
  "to_inventory_unit_id" text NOT NULL,
  "reason" text NOT NULL,
  "invalidated_quote_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "deal_vehicle_change_events_deal_fk" FOREIGN KEY ("organization_id","deal_id") REFERENCES "deals"("organization_id","id"),
  CONSTRAINT "deal_vehicle_change_events_customer_lead_fk" FOREIGN KEY ("organization_id","customer_id","lead_id") REFERENCES "leads"("organization_id","customer_id","id"),
  CONSTRAINT "deal_vehicle_change_events_from_vehicle_fk" FOREIGN KEY ("organization_id","from_vehicle_id") REFERENCES "vehicles"("organization_id","id"),
  CONSTRAINT "deal_vehicle_change_events_to_inventory_fk" FOREIGN KEY ("organization_id","location_id","to_vehicle_id","to_inventory_unit_id") REFERENCES "inventory_units"("organization_id","location_id","vehicle_id","id"),
  CONSTRAINT "deal_vehicle_change_events_id_format" CHECK ("id" ~ '^dvc_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deal_vehicle_change_events_changed" CHECK ("from_vehicle_id" <> "to_vehicle_id" OR "from_inventory_unit_id" IS DISTINCT FROM "to_inventory_unit_id"),
  CONSTRAINT "deal_vehicle_change_events_reason" CHECK (char_length("reason") BETWEEN 1 AND 1000)
);
CREATE UNIQUE INDEX "deal_vehicle_change_events_org_id_unique" ON "deal_vehicle_change_events"("organization_id","id");
CREATE UNIQUE INDEX "deal_vehicle_change_events_idempotency_unique" ON "deal_vehicle_change_events"("organization_id","idempotency_key");
CREATE INDEX "deal_vehicle_change_events_deal_time_idx" ON "deal_vehicle_change_events"("organization_id","deal_id","occurred_at");
ALTER TABLE "deal_vehicle_change_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_vehicle_change_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deal_vehicle_change_events_current_tenant_select" ON "deal_vehicle_change_events" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "deal_vehicle_change_events_current_tenant_insert" ON "deal_vehicle_change_events" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),''));
