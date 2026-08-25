CREATE TYPE "communication_channel" AS ENUM ('call','sms','email');
CREATE TYPE "communication_direction" AS ENUM ('inbound','outbound');
CREATE TYPE "communication_status" AS ENUM ('attempted','sent','delivered','received','failed');

CREATE TABLE "communications" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text,
  "customer_id" text NOT NULL,
  "lead_id" text,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "channel" "communication_channel" NOT NULL,
  "direction" "communication_direction" NOT NULL,
  "status" "communication_status" NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "summary" text NOT NULL,
  "external_message_id" text,
  "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "communications_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "communications_same_organization_customer_fk" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id"),
  CONSTRAINT "communications_same_organization_lead_fk" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id"),
  CONSTRAINT "communications_id_format" CHECK ("id" ~ '^com_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "communications_summary_length" CHECK (char_length("summary") between 1 and 1000)
);
CREATE UNIQUE INDEX "communications_organization_idempotency_unique" ON "communications" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "communications_provider_message_unique" ON "communications" ("organization_id", "channel", "external_message_id") WHERE "external_message_id" is not null;
CREATE INDEX "communications_customer_occurred_idx" ON "communications" ("organization_id", "customer_id", "occurred_at");

ALTER TABLE "communications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "communications_current_tenant_all" ON "communications" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
