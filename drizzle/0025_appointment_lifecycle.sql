CREATE TABLE "appointment_status_events" (
  "id" text PRIMARY KEY,"organization_id" text NOT NULL,"appointment_id" text NOT NULL,
  "from_status" "appointment_status","to_status" "appointment_status" NOT NULL,
  "reason" text,"occurred_at" timestamptz DEFAULT now() NOT NULL,"idempotency_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "appointment_status_events_id_format" CHECK ("id" ~ '^ase_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "appointment_status_events_reason_length" CHECK ("reason" IS NULL OR length(trim("reason")) BETWEEN 1 AND 1000),
  CONSTRAINT "appointment_status_events_status_change" CHECK ("from_status" IS NULL OR "from_status"<>"to_status"),
  CONSTRAINT "appointment_status_events_same_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "appointments"("organization_id","id")
);
CREATE UNIQUE INDEX "appointment_status_events_organization_id_unique" ON "appointment_status_events"("organization_id","id");
CREATE UNIQUE INDEX "appointment_status_events_idempotency_unique" ON "appointment_status_events"("organization_id","idempotency_key");
CREATE INDEX "appointment_status_events_appointment_time_idx" ON "appointment_status_events"("organization_id","appointment_id","occurred_at");
ALTER TABLE "appointment_status_events" ENABLE ROW LEVEL SECURITY;ALTER TABLE "appointment_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "appointment_status_events_current_tenant_select" ON "appointment_status_events" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "appointment_status_events_current_tenant_insert" ON "appointment_status_events" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE FUNCTION prevent_appointment_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.organization_id<>OLD.organization_id OR NEW.location_id IS DISTINCT FROM OLD.location_id OR NEW.customer_id<>OLD.customer_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.starts_at<>OLD.starts_at OR NEW.ends_at<>OLD.ends_at OR NEW.timezone<>OLD.timezone OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'appointment authority fields are immutable';END IF;RETURN NEW;END $$;
CREATE TRIGGER "appointments_authority_immutable" BEFORE UPDATE ON "appointments" FOR EACH ROW EXECUTE FUNCTION prevent_appointment_authority_rewrite();
