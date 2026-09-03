CREATE TYPE "quote_approval_status" AS ENUM ('pending','approved','declined');

CREATE TABLE "deal_quote_approvals" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "status" "quote_approval_status" DEFAULT 'pending' NOT NULL,
  "request_reason" text,
  "decision_reason" text,
  "requested_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "requested_at" timestamptz DEFAULT now() NOT NULL,
  "decided_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "decided_at" timestamptz,
  "request_idempotency_key" text NOT NULL,
  "decision_idempotency_key" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_approvals_same_organization_quote_fk"
    FOREIGN KEY ("organization_id", "quote_id")
    REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "quote_approvals_id_format"
    CHECK ("id" ~ '^qap_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_approvals_request_reason_length"
    CHECK ("request_reason" is null or char_length("request_reason") <= 1000),
  CONSTRAINT "quote_approvals_decision_reason_length"
    CHECK ("decision_reason" is null or char_length("decision_reason") <= 1000),
  CONSTRAINT "quote_approvals_decision_shape"
    CHECK (
      ("status" = 'pending' AND "decided_by" is null AND "decided_at" is null AND "decision_idempotency_key" is null)
      OR
      ("status" IN ('approved','declined') AND "decided_at" is not null AND "decision_idempotency_key" is not null)
    ),
  CONSTRAINT "quote_approvals_decline_reason_required"
    CHECK ("status" <> 'declined' OR (nullif(trim("decision_reason"), '') is not null))
);

CREATE UNIQUE INDEX "quote_approvals_organization_id_unique"
  ON "deal_quote_approvals" ("organization_id", "id");
CREATE UNIQUE INDEX "quote_approvals_one_per_quote_unique"
  ON "deal_quote_approvals" ("organization_id", "quote_id");
CREATE UNIQUE INDEX "quote_approvals_request_idempotency_unique"
  ON "deal_quote_approvals" ("organization_id", "request_idempotency_key");
CREATE UNIQUE INDEX "quote_approvals_decision_idempotency_unique"
  ON "deal_quote_approvals" ("organization_id", "decision_idempotency_key")
  WHERE "decision_idempotency_key" is not null;
CREATE INDEX "quote_approvals_status_time_idx"
  ON "deal_quote_approvals" ("organization_id", "status", "requested_at");

ALTER TABLE "deal_quote_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_approvals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_approvals_current_tenant_select"
  ON "deal_quote_approvals" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_approvals_current_tenant_insert"
  ON "deal_quote_approvals" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_approvals_current_tenant_update"
  ON "deal_quote_approvals" FOR UPDATE
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE FUNCTION prevent_quote_approval_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.organization_id, NEW.quote_id, NEW.requested_by, NEW.requested_at, NEW.request_idempotency_key)
     IS DISTINCT FROM
     (OLD.organization_id, OLD.quote_id, OLD.requested_by, OLD.requested_at, OLD.request_idempotency_key) THEN
    RAISE EXCEPTION 'Quote approval requests are immutable';
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Quote approval decisions are terminal';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "deal_quote_approvals_guard"
  BEFORE UPDATE ON "deal_quote_approvals"
  FOR EACH ROW EXECUTE FUNCTION prevent_quote_approval_rewrite();
