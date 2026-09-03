CREATE TYPE "lease_term_source_type" AS ENUM (
  'manual-entry',
  'lender-quote',
  'oem-program',
  'dealer-program'
);

CREATE TABLE "quote_lease_terms" (
  "quote_id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "adjusted_cap_cost_cents" integer NOT NULL,
  "residual_value_cents" integer NOT NULL,
  "money_factor_ppm" integer NOT NULL,
  "term_months" integer NOT NULL,
  "annual_mileage" integer,
  "acquisition_fee_cents" integer DEFAULT 0 NOT NULL,
  "cap_cost_reduction_cents" integer DEFAULT 0 NOT NULL,
  "rebate_cents" integer DEFAULT 0 NOT NULL,
  "base_payment_cents" integer NOT NULL,
  "source_type" "lease_term_source_type" NOT NULL,
  "source_label" text NOT NULL,
  "source_reference" text,
  "captured_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "captured_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_lease_terms_same_organization_quote_fk"
    FOREIGN KEY ("organization_id", "quote_id")
    REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "quote_lease_terms_cap_cost_nonnegative"
    CHECK ("adjusted_cap_cost_cents" >= 0),
  CONSTRAINT "quote_lease_terms_residual_nonnegative"
    CHECK ("residual_value_cents" >= 0),
  CONSTRAINT "quote_lease_terms_money_factor_range"
    CHECK ("money_factor_ppm" >= 0 AND "money_factor_ppm" <= 100000),
  CONSTRAINT "quote_lease_terms_term_range"
    CHECK ("term_months" >= 1 AND "term_months" <= 60),
  CONSTRAINT "quote_lease_terms_mileage_positive"
    CHECK ("annual_mileage" is null OR "annual_mileage" > 0),
  CONSTRAINT "quote_lease_terms_amounts_nonnegative"
    CHECK (
      "acquisition_fee_cents" >= 0
      AND "cap_cost_reduction_cents" >= 0
      AND "rebate_cents" >= 0
      AND "base_payment_cents" >= 0
    ),
  CONSTRAINT "quote_lease_terms_source_label"
    CHECK (char_length(trim("source_label")) BETWEEN 1 AND 200),
  CONSTRAINT "quote_lease_terms_source_reference"
    CHECK ("source_reference" is null OR char_length("source_reference") <= 500)
);

CREATE UNIQUE INDEX "quote_lease_terms_org_quote_unique"
  ON "quote_lease_terms" ("organization_id", "quote_id");

ALTER TABLE "quote_lease_terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_lease_terms" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_lease_terms_current_tenant_select"
  ON "quote_lease_terms" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_lease_terms_current_tenant_insert"
  ON "quote_lease_terms" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE FUNCTION prevent_quote_lease_terms_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quote lease terms are immutable; create a new Quote version';
END $$;
CREATE TRIGGER "quote_lease_terms_immutable"
  BEFORE UPDATE OR DELETE ON "quote_lease_terms"
  FOR EACH ROW EXECUTE FUNCTION prevent_quote_lease_terms_rewrite();
