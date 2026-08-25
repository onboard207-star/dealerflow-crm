CREATE TYPE "consent_action" AS ENUM ('granted','revoked');
CREATE TYPE "consent_purpose" AS ENUM ('operational','marketing');
CREATE TYPE "consent_basis" AS ENUM ('express-written','customer-initiated','not-applicable');
CREATE TYPE "send_attempt_status" AS ENUM ('queued','dispatching','accepted','delivery-unknown','rejected');

CREATE TABLE "communication_consent_events" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "location_id" text,
  "customer_id" text NOT NULL, "channel" "communication_channel" NOT NULL,
  "purpose" "consent_purpose" NOT NULL, "address" text NOT NULL,
  "action" "consent_action" NOT NULL, "basis" "consent_basis" NOT NULL,
  "evidence_reference" text NOT NULL, "occurred_at" timestamptz NOT NULL,
  "idempotency_key" text NOT NULL, "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "consent_events_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "consent_events_same_organization_customer_fk" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id"),
  CONSTRAINT "consent_events_id_format" CHECK ("id" ~ '^cns_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "consent_events_basis_action" CHECK (("action" = 'revoked' AND "basis" = 'not-applicable') OR ("action" = 'granted' AND "basis" <> 'not-applicable'))
);
CREATE UNIQUE INDEX "consent_events_organization_id_unique" ON "communication_consent_events" ("organization_id", "id");
CREATE UNIQUE INDEX "consent_events_organization_idempotency_unique" ON "communication_consent_events" ("organization_id", "idempotency_key");
CREATE INDEX "consent_events_effective_idx" ON "communication_consent_events" ("organization_id", "customer_id", "channel", "purpose", "address", "occurred_at" DESC);

CREATE TABLE "communication_send_attempts" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "location_id" text,
  "customer_id" text NOT NULL, "lead_id" text, "integration_id" text NOT NULL,
  "consent_event_id" text NOT NULL, "channel" "communication_channel" NOT NULL,
  "purpose" "consent_purpose" NOT NULL, "destination" text NOT NULL, "body" text NOT NULL,
  "status" "send_attempt_status" DEFAULT 'queued' NOT NULL, "not_before" timestamptz NOT NULL,
  "provider_message_id" text, "provider_status" text, "failure_code" text,
  "idempotency_key" text NOT NULL, "requested_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "send_attempts_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "send_attempts_same_organization_customer_fk" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "customers"("organization_id", "id"),
  CONSTRAINT "send_attempts_same_organization_lead_fk" FOREIGN KEY ("organization_id", "lead_id") REFERENCES "leads"("organization_id", "id"),
  CONSTRAINT "send_attempts_same_organization_integration_fk" FOREIGN KEY ("organization_id", "integration_id") REFERENCES "integration_accounts"("organization_id", "id"),
  CONSTRAINT "send_attempts_same_organization_consent_fk" FOREIGN KEY ("organization_id", "consent_event_id") REFERENCES "communication_consent_events"("organization_id", "id"),
  CONSTRAINT "send_attempts_id_format" CHECK ("id" ~ '^snd_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "send_attempts_body_length" CHECK (char_length("body") between 1 and 1600)
);
CREATE UNIQUE INDEX "send_attempts_organization_id_unique" ON "communication_send_attempts" ("organization_id", "id");
CREATE UNIQUE INDEX "send_attempts_organization_idempotency_unique" ON "communication_send_attempts" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "send_attempts_provider_message_unique" ON "communication_send_attempts" ("organization_id", "provider_message_id") WHERE "provider_message_id" is not null;
CREATE INDEX "send_attempts_dispatch_idx" ON "communication_send_attempts" ("organization_id", "status", "not_before");

ALTER TABLE "communication_consent_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_consent_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "consent_events_current_tenant_all" ON "communication_consent_events" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
ALTER TABLE "communication_send_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_send_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "send_attempts_current_tenant_all" ON "communication_send_attempts" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
