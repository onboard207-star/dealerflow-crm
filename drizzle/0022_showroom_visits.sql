CREATE TYPE "showroom_visit_status" AS ENUM ('checked-in','active','completed','cancelled');
CREATE TABLE "showroom_visits" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "lead_id" text,
  "appointment_id" text,
  "assigned_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "status" "showroom_visit_status" DEFAULT 'checked-in' NOT NULL,
  "purpose" text NOT NULL,
  "arrived_at" timestamptz NOT NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "cancelled_at" timestamptz,
  "outcome" text,
  "notes" text,
  "idempotency_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updated_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "showroom_visits_id_format" CHECK ("id" ~ '^vis_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "showroom_visits_purpose_length" CHECK (length(trim("purpose")) BETWEEN 1 AND 200),
  CONSTRAINT "showroom_visits_notes_length" CHECK ("notes" IS NULL OR length("notes") <= 2000),
  CONSTRAINT "showroom_visits_outcome_length" CHECK ("outcome" IS NULL OR length(trim("outcome")) BETWEEN 1 AND 500),
  CONSTRAINT "showroom_visits_state_times" CHECK (("status" NOT IN ('active','completed') OR "started_at" IS NOT NULL) AND ("status" <> 'checked-in' OR "started_at" IS NULL) AND ("status"='completed')=("completed_at" IS NOT NULL) AND ("status"='cancelled')=("cancelled_at" IS NOT NULL)),
  CONSTRAINT "showroom_visits_completion_outcome" CHECK ("status" <> 'completed' OR "outcome" IS NOT NULL),
  CONSTRAINT "showroom_visits_time_order" CHECK (("started_at" IS NULL OR "started_at">="arrived_at") AND ("completed_at" IS NULL OR "completed_at">="started_at") AND ("cancelled_at" IS NULL OR "cancelled_at">="arrived_at")),
  CONSTRAINT "showroom_visits_same_location_fk" FOREIGN KEY ("organization_id","location_id") REFERENCES "locations"("organization_id","id"),
  CONSTRAINT "showroom_visits_same_customer_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "customers"("organization_id","id"),
  CONSTRAINT "showroom_visits_same_lead_customer_fk" FOREIGN KEY ("organization_id","customer_id","lead_id") REFERENCES "leads"("organization_id","customer_id","id")
);
CREATE UNIQUE INDEX "appointments_organization_customer_id_unique" ON "appointments"("organization_id","customer_id","id");
ALTER TABLE "showroom_visits" ADD CONSTRAINT "showroom_visits_same_appointment_customer_fk" FOREIGN KEY ("organization_id","customer_id","appointment_id") REFERENCES "appointments"("organization_id","customer_id","id");
CREATE UNIQUE INDEX "showroom_visits_organization_id_unique" ON "showroom_visits"("organization_id","id");
CREATE UNIQUE INDEX "showroom_visits_idempotency_unique" ON "showroom_visits"("organization_id","idempotency_key");
CREATE UNIQUE INDEX "showroom_visits_customer_active_unique" ON "showroom_visits"("organization_id","customer_id") WHERE "status" IN ('checked-in','active');
CREATE INDEX "showroom_visits_location_arrived_idx" ON "showroom_visits"("organization_id","location_id","arrived_at" DESC);

CREATE TABLE "showroom_visit_status_events" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL,
  "visit_id" text NOT NULL,
  "from_status" "showroom_visit_status",
  "to_status" "showroom_visit_status" NOT NULL,
  "reason" text,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "showroom_visit_events_id_format" CHECK ("id" ~ '^vse_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "showroom_visit_events_reason_length" CHECK ("reason" IS NULL OR length(trim("reason")) BETWEEN 1 AND 1000),
  CONSTRAINT "showroom_visit_events_status_change" CHECK ("from_status" IS NULL OR "from_status" <> "to_status"),
  CONSTRAINT "showroom_visit_events_same_visit_fk" FOREIGN KEY ("organization_id","visit_id") REFERENCES "showroom_visits"("organization_id","id")
);
CREATE UNIQUE INDEX "showroom_visit_events_organization_id_unique" ON "showroom_visit_status_events"("organization_id","id");
CREATE UNIQUE INDEX "showroom_visit_events_idempotency_unique" ON "showroom_visit_status_events"("organization_id","idempotency_key");
CREATE INDEX "showroom_visit_events_visit_time_idx" ON "showroom_visit_status_events"("organization_id","visit_id","occurred_at");

ALTER TABLE "showroom_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "showroom_visits" FORCE ROW LEVEL SECURITY;
CREATE POLICY "showroom_visits_current_tenant" ON "showroom_visits" FOR ALL USING ("organization_id"=nullif(current_setting('app.organization_id',true),'')) WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));
ALTER TABLE "showroom_visit_status_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "showroom_visit_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "showroom_visit_events_current_tenant_select" ON "showroom_visit_status_events" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "showroom_visit_events_current_tenant_insert" ON "showroom_visit_status_events" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION prevent_showroom_visit_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id<>OLD.organization_id OR NEW.location_id<>OLD.location_id OR NEW.customer_id<>OLD.customer_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.arrived_at<>OLD.arrived_at OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'showroom visit authority fields are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "showroom_visits_authority_immutable" BEFORE UPDATE ON "showroom_visits" FOR EACH ROW EXECUTE FUNCTION prevent_showroom_visit_authority_rewrite();
