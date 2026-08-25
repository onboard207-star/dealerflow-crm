CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "integration_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "location_id" text,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "credential_reference" text NOT NULL,
  "webhook_key_hash" text NOT NULL,
  "public_base_url" text NOT NULL,
  "default_from_address" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "integration_accounts_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "integration_accounts_id_format" CHECK ("id" ~ '^int_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "integration_accounts_provider" CHECK ("provider" in ('twilio')),
  CONSTRAINT "integration_accounts_public_https" CHECK ("public_base_url" ~ '^https://[^/]+(:[0-9]+)?$'),
  CONSTRAINT "integration_accounts_credential_reference" CHECK ("credential_reference" ~ '^[A-Z][A-Z0-9_]{2,63}$')
);
CREATE UNIQUE INDEX "integration_accounts_provider_account_unique" ON "integration_accounts" ("provider", "provider_account_id");
CREATE UNIQUE INDEX "integration_accounts_webhook_key_unique" ON "integration_accounts" ("webhook_key_hash");
CREATE UNIQUE INDEX "integration_accounts_organization_id_unique" ON "integration_accounts" ("organization_id", "id");
CREATE INDEX "integration_accounts_organization_idx" ON "integration_accounts" ("organization_id");

CREATE TYPE "integration_event_status" AS ENUM ('pending','processed','unmatched','failed');
CREATE TABLE "integration_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "integration_id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "status" "integration_event_status" DEFAULT 'pending' NOT NULL,
  "payload" jsonb NOT NULL,
  "failure_code" text,
  "processed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "integration_events_same_organization_integration_fk" FOREIGN KEY ("organization_id", "integration_id") REFERENCES "integration_accounts"("organization_id", "id"),
  CONSTRAINT "integration_events_id_format" CHECK ("id" ~ '^evt_[a-z0-9_-]{6,64}$')
);
CREATE UNIQUE INDEX "integration_events_provider_event_unique" ON "integration_events" ("organization_id", "provider", "provider_event_id", "event_type");
CREATE INDEX "integration_events_status_idx" ON "integration_events" ("organization_id", "status", "created_at");

ALTER TABLE "integration_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "integration_accounts_current_tenant_all" ON "integration_accounts" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE "integration_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "integration_events_current_tenant_all" ON "integration_events" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE OR REPLACE FUNCTION resolve_twilio_webhook_account(webhook_key text, account_sid text)
RETURNS TABLE (integration_id text, organization_id text, location_id text,
  credential_reference text, public_base_url text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id, integration_accounts.organization_id, integration_accounts.location_id,
    integration_accounts.credential_reference, integration_accounts.public_base_url
  FROM integration_accounts
  WHERE provider = 'twilio' AND provider_account_id = account_sid AND active = true
    AND webhook_key_hash = encode(digest(webhook_key, 'sha256'), 'hex')
  LIMIT 1
$$;
