CREATE TYPE "transactional_email_kind" AS ENUM ('email-verification', 'password-reset', 'organization-invitation');
CREATE TYPE "transactional_email_status" AS ENUM ('queued', 'sending', 'sent', 'failed');

CREATE TABLE "transactional_email_messages" (
  "id" text PRIMARY KEY,
  "kind" "transactional_email_kind" NOT NULL,
  "recipient_email" text NOT NULL,
  "subject" text NOT NULL,
  "text_body" text NOT NULL,
  "html_body" text NOT NULL,
  "status" "transactional_email_status" DEFAULT 'queued' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "not_before" timestamptz DEFAULT now() NOT NULL,
  "last_error_code" text,
  "provider_message_id" text,
  "idempotency_key" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "sent_at" timestamptz,
  CONSTRAINT "transactional_email_id_format" CHECK ("id" ~ '^tem_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "transactional_email_attempt_count" CHECK ("attempt_count" >= 0 AND "attempt_count" <= 10),
  CONSTRAINT "transactional_email_recipient_nonempty" CHECK (length(trim("recipient_email")) > 3)
);

CREATE UNIQUE INDEX "transactional_email_idempotency_unique" ON "transactional_email_messages" ("idempotency_key");
CREATE INDEX "transactional_email_due_idx" ON "transactional_email_messages" ("not_before", "created_at") WHERE "status" IN ('queued', 'failed');

REVOKE ALL ON "transactional_email_messages" FROM PUBLIC;
