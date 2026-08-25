CREATE TYPE "ai_recommendation_status" AS ENUM ('pending','completed','refused','failed');
CREATE TYPE "ai_review_decision" AS ENUM ('accepted','dismissed');
CREATE TABLE "ai_recommendation_runs" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "lead_id" text REFERENCES "leads"("id") ON DELETE SET NULL,
  "prompt_version" text NOT NULL,
  "model" text,
  "status" "ai_recommendation_status" DEFAULT 'pending' NOT NULL,
  "evidence" jsonb NOT NULL,
  "output" jsonb,
  "refusal" text,
  "provider_response_id" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "latency_ms" integer,
  "failure_code" text,
  "idempotency_key" text NOT NULL,
  "initiated_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "review_decision" "ai_review_decision",
  "review_note" text,
  "reviewed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "ai_runs_id_format" CHECK ("id" ~ '^air_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "ai_runs_evidence_array" CHECK (jsonb_typeof("evidence")='array' AND jsonb_array_length("evidence") BETWEEN 1 AND 30),
  CONSTRAINT "ai_runs_token_counts" CHECK (("input_tokens" IS NULL OR "input_tokens">=0) AND ("output_tokens" IS NULL OR "output_tokens">=0)),
  CONSTRAINT "ai_runs_latency" CHECK ("latency_ms" IS NULL OR "latency_ms">=0),
  CONSTRAINT "ai_runs_review_consistent" CHECK (("review_decision" IS NULL)=("reviewed_at" IS NULL) AND ("reviewed_at" IS NULL)=("reviewed_by" IS NULL)),
  CONSTRAINT "ai_runs_same_customer_lead_fk" FOREIGN KEY ("organization_id","customer_id","lead_id") REFERENCES "leads"("organization_id","customer_id","id")
);
CREATE UNIQUE INDEX "ai_runs_organization_id_unique" ON "ai_recommendation_runs"("organization_id","id");
CREATE UNIQUE INDEX "ai_runs_organization_idempotency_unique" ON "ai_recommendation_runs"("organization_id","idempotency_key");
CREATE UNIQUE INDEX "ai_runs_customer_pending_unique" ON "ai_recommendation_runs"("organization_id","customer_id") WHERE "status"='pending';
CREATE INDEX "ai_runs_actor_rate_limit_idx" ON "ai_recommendation_runs"("organization_id","initiated_by","created_at");
CREATE INDEX "ai_runs_customer_created_idx" ON "ai_recommendation_runs"("organization_id","customer_id","created_at" DESC);
ALTER TABLE "ai_recommendation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_recommendation_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_runs_current_tenant" ON "ai_recommendation_runs" USING ("organization_id"=nullif(current_setting('app.organization_id',true),'')) WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION prevent_ai_run_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id<>OLD.organization_id OR NEW.customer_id<>OLD.customer_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.prompt_version<>OLD.prompt_version OR NEW.evidence<>OLD.evidence OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.initiated_by<>OLD.initiated_by OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'AI run authority fields are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ai_runs_authority_immutable" BEFORE UPDATE ON "ai_recommendation_runs" FOR EACH ROW EXECUTE FUNCTION prevent_ai_run_authority_rewrite();
