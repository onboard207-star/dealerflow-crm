CREATE TABLE "product_usage_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "user_id" text REFERENCES "users"("id") ON DELETE set null,
  "location_id" text,
  "event_name" text NOT NULL,
  "actor_type" text NOT NULL,
  "data_class" text NOT NULL,
  "workspace" text NOT NULL,
  "feature" text NOT NULL,
  "action" text NOT NULL,
  "role_key" text,
  "release" text NOT NULL,
  "device_class" text NOT NULL,
  "request_id" text,
  "feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "idempotency_key" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_usage_events_same_location_fk" FOREIGN KEY ("organization_id","location_id") REFERENCES "locations"("organization_id","id") ON DELETE restrict,
  CONSTRAINT "product_usage_events_id_format" CHECK ("id" ~ '^pue_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "product_usage_events_name" CHECK ("event_name" ~ '^[a-z][a-z0-9-]{1,39}\.[a-z][a-z0-9-]{1,39}$'),
  CONSTRAINT "product_usage_events_actor_type" CHECK ("actor_type" in ('dealer-user','dealerflow-staff','automation','synthetic')),
  CONSTRAINT "product_usage_events_data_class" CHECK ("data_class" in ('demo','pilot','production')),
  CONSTRAINT "product_usage_events_device_class" CHECK ("device_class" in ('desktop','tablet','mobile','server'))
);
CREATE UNIQUE INDEX "product_usage_events_organization_id_unique" ON "product_usage_events"("organization_id","id");
CREATE UNIQUE INDEX "product_usage_events_idempotency_unique" ON "product_usage_events"("organization_id","idempotency_key");
CREATE INDEX "product_usage_events_tenant_time_idx" ON "product_usage_events"("organization_id","occurred_at");
CREATE INDEX "product_usage_events_release_idx" ON "product_usage_events"("organization_id","release","occurred_at");

ALTER TABLE "product_usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_usage_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "product_usage_events_tenant_isolation" ON "product_usage_events"
  USING ("organization_id" = current_setting('app.organization_id', true))
  WITH CHECK ("organization_id" = current_setting('app.organization_id', true));
