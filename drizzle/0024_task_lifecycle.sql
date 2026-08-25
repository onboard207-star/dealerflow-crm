ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_length" CHECK (length(trim("title")) BETWEEN 1 AND 200);
CREATE UNIQUE INDEX "tasks_organization_id_unique" ON "tasks"("organization_id","id");

CREATE TABLE "task_status_events" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL,
  "task_id" text NOT NULL,
  "from_status" "task_status",
  "to_status" "task_status" NOT NULL,
  "reason" text,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "task_status_events_id_format" CHECK ("id" ~ '^tse_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "task_status_events_reason_length" CHECK ("reason" IS NULL OR length(trim("reason")) BETWEEN 1 AND 1000),
  CONSTRAINT "task_status_events_status_change" CHECK ("from_status" IS NULL OR "from_status" <> "to_status"),
  CONSTRAINT "task_status_events_same_task_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "tasks"("organization_id","id")
);
CREATE UNIQUE INDEX "task_status_events_organization_id_unique" ON "task_status_events"("organization_id","id");
CREATE UNIQUE INDEX "task_status_events_idempotency_unique" ON "task_status_events"("organization_id","idempotency_key");
CREATE INDEX "task_status_events_task_time_idx" ON "task_status_events"("organization_id","task_id","occurred_at");
ALTER TABLE "task_status_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "task_status_events_current_tenant_select" ON "task_status_events" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "task_status_events_current_tenant_insert" ON "task_status_events" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION prevent_task_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id<>OLD.organization_id OR NEW.location_id IS DISTINCT FROM OLD.location_id OR NEW.customer_id<>OLD.customer_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'task authority fields are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "tasks_authority_immutable" BEFORE UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION prevent_task_authority_rewrite();
