CREATE TYPE "appointment_status" AS ENUM ('scheduled','confirmed','arrived','completed','cancelled','no-show');
CREATE TYPE "task_status" AS ENUM ('open','in-progress','completed','cancelled');
CREATE TYPE "task_priority" AS ENUM ('low','normal','high','urgent');

ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_unique" UNIQUE ("organization_id", "id");

CREATE TABLE "appointments" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text,
  "customer_id" text NOT NULL,
  "lead_id" text,
  "assigned_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "timezone" text NOT NULL,
  "notes" text,
  "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "appointments_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "appointments_same_organization_customer_fk" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id"),
  CONSTRAINT "appointments_same_organization_lead_fk" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id"),
  CONSTRAINT "appointments_time_order" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "appointments_id_format" CHECK ("id" ~ '^apt_[a-z0-9_-]{6,64}$')
);
CREATE UNIQUE INDEX "appointments_organization_id_unique" ON "appointments" ("organization_id", "id");
CREATE UNIQUE INDEX "appointments_organization_idempotency_unique" ON "appointments" ("organization_id", "idempotency_key");
CREATE INDEX "appointments_customer_start_idx" ON "appointments" ("organization_id", "customer_id", "starts_at");

CREATE TABLE "tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text,
  "customer_id" text NOT NULL,
  "lead_id" text,
  "appointment_id" text,
  "assigned_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "status" "task_status" DEFAULT 'open' NOT NULL,
  "priority" "task_priority" DEFAULT 'normal' NOT NULL,
  "due_at" timestamptz,
  "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "tasks_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "tasks_same_organization_customer_fk" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id"),
  CONSTRAINT "tasks_same_organization_lead_fk" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id"),
  CONSTRAINT "tasks_same_organization_appointment_fk" FOREIGN KEY ("organization_id", "appointment_id") REFERENCES "appointments"("organization_id", "id"),
  CONSTRAINT "tasks_id_format" CHECK ("id" ~ '^tsk_[a-z0-9_-]{6,64}$')
);
CREATE UNIQUE INDEX "tasks_organization_idempotency_unique" ON "tasks" ("organization_id", "idempotency_key");
CREATE INDEX "tasks_assignee_due_idx" ON "tasks" ("organization_id", "assigned_user_id", "due_at");

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "appointments_current_tenant_all" ON "appointments" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tasks_current_tenant_all" ON "tasks" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
