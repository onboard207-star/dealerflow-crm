CREATE TYPE "finance_term_source_type" AS ENUM (
  'manual-entry',
  'lender-quote',
  'oem-program',
  'dealer-program'
);

CREATE TABLE "quote_commercial_terms" (
  "quote_id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "trade_appraisal_id" text,
  "trade_allowance_cents" integer DEFAULT 0 NOT NULL,
  "trade_payoff_cents" integer DEFAULT 0 NOT NULL,
  "trade_equity_cents" integer DEFAULT 0 NOT NULL,
  "cash_down_cents" integer DEFAULT 0 NOT NULL,
  "amount_financed_cents" integer,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_commercial_terms_same_organization_quote_fk"
    FOREIGN KEY ("organization_id", "quote_id")
    REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "quote_commercial_terms_same_organization_trade_fk"
    FOREIGN KEY ("organization_id", "trade_appraisal_id")
    REFERENCES "trade_appraisals"("organization_id", "id"),
  CONSTRAINT "quote_commercial_terms_trade_equity_consistent"
    CHECK ("trade_equity_cents" = "trade_allowance_cents" - "trade_payoff_cents"),
  CONSTRAINT "quote_commercial_terms_nonnegative_inputs"
    CHECK (
      "trade_allowance_cents" >= 0
      AND "trade_payoff_cents" >= 0
      AND "cash_down_cents" >= 0
      AND ("amount_financed_cents" is null OR "amount_financed_cents" >= 0)
    )
);
CREATE UNIQUE INDEX "quote_commercial_terms_org_quote_unique"
  ON "quote_commercial_terms" ("organization_id", "quote_id");

CREATE TABLE "quote_finance_terms" (
  "quote_id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "apr_basis_points" integer NOT NULL,
  "term_months" integer NOT NULL,
  "estimated_payment_cents" integer NOT NULL,
  "source_type" "finance_term_source_type" NOT NULL,
  "source_label" text NOT NULL,
  "source_reference" text,
  "captured_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "captured_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_finance_terms_same_organization_quote_fk"
    FOREIGN KEY ("organization_id", "quote_id")
    REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "quote_finance_terms_apr_range"
    CHECK ("apr_basis_points" >= 0 AND "apr_basis_points" <= 10000),
  CONSTRAINT "quote_finance_terms_term_range"
    CHECK ("term_months" >= 1 AND "term_months" <= 120),
  CONSTRAINT "quote_finance_terms_payment_nonnegative"
    CHECK ("estimated_payment_cents" >= 0),
  CONSTRAINT "quote_finance_terms_source_label"
    CHECK (char_length(trim("source_label")) BETWEEN 1 AND 200),
  CONSTRAINT "quote_finance_terms_source_reference"
    CHECK ("source_reference" is null OR char_length("source_reference") <= 500)
);
CREATE UNIQUE INDEX "quote_finance_terms_org_quote_unique"
  ON "quote_finance_terms" ("organization_id", "quote_id");

ALTER TABLE "quote_commercial_terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_commercial_terms" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_commercial_terms_current_tenant_select"
  ON "quote_commercial_terms" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_commercial_terms_current_tenant_insert"
  ON "quote_commercial_terms" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE "quote_finance_terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_finance_terms" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_finance_terms_current_tenant_select"
  ON "quote_finance_terms" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_finance_terms_current_tenant_insert"
  ON "quote_finance_terms" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE FUNCTION prevent_quote_commercial_terms_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quote commercial terms are immutable; create a new Quote version';
END $$;
CREATE TRIGGER "quote_commercial_terms_immutable"
  BEFORE UPDATE OR DELETE ON "quote_commercial_terms"
  FOR EACH ROW EXECUTE FUNCTION prevent_quote_commercial_terms_rewrite();

CREATE FUNCTION prevent_quote_finance_terms_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quote finance terms are immutable; create a new Quote version';
END $$;
CREATE TRIGGER "quote_finance_terms_immutable"
  BEFORE UPDATE OR DELETE ON "quote_finance_terms"
  FOR EACH ROW EXECUTE FUNCTION prevent_quote_finance_terms_rewrite();
