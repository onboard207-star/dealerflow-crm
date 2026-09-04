CREATE TABLE "lead_intake_records" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "lead_id" text NOT NULL,
  "source" text NOT NULL,
  "source_lead_id" text,
  "received_at" timestamptz NOT NULL,
  "preferred_contact_method" text,
  "message" text,
  "raw_payload" jsonb,
  "vehicle_interest" jsonb,
  "resolved_vehicle_id" text,
  "resolved_inventory_unit_id" text,
  "vehicle_match_method" text,
  "assigned_user_id" text,
  "follow_up_task_id" text NOT NULL,
  "appointment_id" text,
  "communication_status" text DEFAULT 'not-sent' NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "lead_intakes_same_lead_fk" FOREIGN KEY ("organization_id","customer_id","lead_id") REFERENCES "leads"("organization_id","customer_id","id"),
  CONSTRAINT "lead_intakes_location_fk" FOREIGN KEY ("organization_id","location_id") REFERENCES "locations"("organization_id","id"),
  CONSTRAINT "lead_intakes_vehicle_fk" FOREIGN KEY ("organization_id","resolved_vehicle_id") REFERENCES "vehicles"("organization_id","id"),
  CONSTRAINT "lead_intakes_inventory_fk" FOREIGN KEY ("organization_id","location_id","resolved_inventory_unit_id") REFERENCES "inventory_units"("organization_id","location_id","id"),
  CONSTRAINT "lead_intakes_task_fk" FOREIGN KEY ("organization_id","follow_up_task_id") REFERENCES "tasks"("organization_id","id"),
  CONSTRAINT "lead_intakes_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "appointments"("organization_id","id"),
  CONSTRAINT "lead_intakes_id_format" CHECK ("id" ~ '^lir_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "lead_intakes_source_length" CHECK (length(trim("source")) BETWEEN 1 AND 100),
  CONSTRAINT "lead_intakes_source_id_length" CHECK ("source_lead_id" IS NULL OR length(trim("source_lead_id")) BETWEEN 1 AND 200),
  CONSTRAINT "lead_intakes_message_length" CHECK ("message" IS NULL OR length("message") <= 4000),
  CONSTRAINT "lead_intakes_contact_method" CHECK ("preferred_contact_method" IS NULL OR "preferred_contact_method" IN ('phone','sms','email')),
  CONSTRAINT "lead_intakes_match_method" CHECK ("vehicle_match_method" IS NULL OR "vehicle_match_method" IN ('vin','stock-number','exact-description')),
  CONSTRAINT "lead_intakes_vehicle_shape" CHECK (("resolved_inventory_unit_id" IS NULL) OR ("resolved_vehicle_id" IS NOT NULL)),
  CONSTRAINT "lead_intakes_communication_status" CHECK ("communication_status" IN ('not-sent','recorded','appointment-requested','appointment-scheduled'))
);
CREATE UNIQUE INDEX "lead_intakes_org_id_unique" ON "lead_intake_records" ("organization_id","id");
CREATE UNIQUE INDEX "lead_intakes_idempotency_unique" ON "lead_intake_records" ("organization_id","idempotency_key");
CREATE UNIQUE INDEX "lead_intakes_source_lead_unique" ON "lead_intake_records" ("organization_id",lower("source"),"source_lead_id") WHERE "source_lead_id" IS NOT NULL;
CREATE INDEX "lead_intakes_received_idx" ON "lead_intake_records" ("organization_id","location_id","received_at" DESC);
CREATE INDEX "lead_intakes_lead_idx" ON "lead_intake_records" ("organization_id","lead_id");

ALTER TABLE "lead_intake_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_intake_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lead_intakes_tenant_select" ON "lead_intake_records" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "lead_intakes_tenant_insert" ON "lead_intake_records" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION prevent_lead_intake_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Lead intake evidence is immutable'; END $$;
CREATE TRIGGER "lead_intakes_immutable" BEFORE UPDATE OR DELETE ON "lead_intake_records" FOR EACH ROW EXECUTE FUNCTION prevent_lead_intake_rewrite();
