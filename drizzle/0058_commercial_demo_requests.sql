ALTER TYPE "transactional_email_kind" ADD VALUE IF NOT EXISTS 'commercial-demo-request';

CREATE TABLE "commercial_demo_requests" (
  "id" text PRIMARY KEY,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "work_email" text NOT NULL,
  "phone" text,
  "dealership_name" text NOT NULL,
  "role" text NOT NULL,
  "rooftop_range" text NOT NULL,
  "current_crm" text,
  "primary_interest" text NOT NULL,
  "preferred_contact_method" text NOT NULL,
  "notes" text,
  "status" text DEFAULT 'received' NOT NULL,
  "idempotency_key" text NOT NULL,
  "deduplication_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "network_fingerprint" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "commercial_demo_requests_id_format" CHECK ("id" ~ '^cdr_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "commercial_demo_requests_status" CHECK ("status" IN ('received','notification-queued','notified','notification-failed','closed')),
  CONSTRAINT "commercial_demo_requests_contact" CHECK ("preferred_contact_method" IN ('Email','Phone')),
  CONSTRAINT "commercial_demo_requests_email" CHECK ("work_email" = lower("work_email") AND length("work_email") BETWEEN 5 AND 320),
  CONSTRAINT "commercial_demo_requests_bounded" CHECK (length("first_name") <= 100 AND length("last_name") <= 100 AND length("dealership_name") <= 200 AND length(COALESCE("notes",'')) <= 1000)
);

CREATE UNIQUE INDEX "commercial_demo_requests_idempotency_unique" ON "commercial_demo_requests" ("idempotency_key");
CREATE UNIQUE INDEX "commercial_demo_requests_deduplication_unique" ON "commercial_demo_requests" ("deduplication_key");
CREATE INDEX "commercial_demo_requests_network_created_idx" ON "commercial_demo_requests" ("network_fingerprint", "created_at");
CREATE INDEX "commercial_demo_requests_email_created_idx" ON "commercial_demo_requests" ("work_email", "created_at");

CREATE TABLE "commercial_demo_request_events" (
  "id" text PRIMARY KEY,
  "request_id" text NOT NULL REFERENCES "commercial_demo_requests"("id") ON DELETE RESTRICT,
  "event_type" text NOT NULL,
  "evidence" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "commercial_demo_request_events_id_format" CHECK ("id" ~ '^cde_[a-z0-9_-]{6,64}$')
);

CREATE INDEX "commercial_demo_request_events_request_idx" ON "commercial_demo_request_events" ("request_id", "created_at");

REVOKE ALL ON "commercial_demo_requests" FROM PUBLIC;
REVOKE ALL ON "commercial_demo_request_events" FROM PUBLIC;
