CREATE TYPE "incentive_source_type" AS ENUM (
  'oem-program',
  'dealer-program',
  'lender-program',
  'government-program'
);

CREATE TYPE "incentive_eligibility_status" AS ENUM (
  'pending',
  'verified',
  'ineligible'
);

-- PostgreSQL requires the referenced columns to match a unique key exactly.
-- The earlier (organization_id, id) key protects tenant identity, while this
-- key additionally proves that the line belongs to the referenced Quote.
CREATE UNIQUE INDEX "deal_quote_lines_org_quote_id_unique"
  ON "deal_quote_lines" ("organization_id", "quote_id", "id");

CREATE TABLE "incentive_programs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "source_type" "incentive_source_type" NOT NULL,
  "source_label" text NOT NULL,
  "source_reference" text,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "incentive_programs_same_organization_location_fk"
    FOREIGN KEY ("organization_id", "location_id")
    REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "incentive_programs_id_format"
    CHECK ("id" ~ '^inc_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "incentive_programs_code_length"
    CHECK (char_length(trim("code")) BETWEEN 1 AND 100),
  CONSTRAINT "incentive_programs_name_length"
    CHECK (char_length(trim("name")) BETWEEN 1 AND 200),
  CONSTRAINT "incentive_programs_source_label_length"
    CHECK (char_length(trim("source_label")) BETWEEN 1 AND 200),
  CONSTRAINT "incentive_programs_source_reference_length"
    CHECK ("source_reference" is null OR char_length("source_reference") <= 500),
  CONSTRAINT "incentive_programs_dates"
    CHECK ("starts_at" is null OR "ends_at" is null OR "ends_at" > "starts_at")
);
CREATE UNIQUE INDEX "incentive_programs_org_id_unique"
  ON "incentive_programs" ("organization_id", "id");
CREATE UNIQUE INDEX "incentive_programs_scope_code_unique"
  ON "incentive_programs" ("organization_id", coalesce("location_id", ''), "code");

CREATE TABLE "quote_incentive_applications" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "quote_line_id" text NOT NULL,
  "program_id" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "eligibility_status" "incentive_eligibility_status" DEFAULT 'pending' NOT NULL,
  "eligibility_basis" text,
  "verified_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "verified_at" timestamptz,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_incentives_same_organization_quote_fk"
    FOREIGN KEY ("organization_id", "quote_id")
    REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "quote_incentives_same_organization_line_fk"
    FOREIGN KEY ("organization_id", "quote_id", "quote_line_id")
    REFERENCES "deal_quote_lines"("organization_id", "quote_id", "id"),
  CONSTRAINT "quote_incentives_same_organization_program_fk"
    FOREIGN KEY ("organization_id", "program_id")
    REFERENCES "incentive_programs"("organization_id", "id"),
  CONSTRAINT "quote_incentives_id_format"
    CHECK ("id" ~ '^qia_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_incentives_amount_positive"
    CHECK ("amount_cents" > 0),
  CONSTRAINT "quote_incentives_basis_length"
    CHECK ("eligibility_basis" is null OR char_length("eligibility_basis") <= 1000),
  CONSTRAINT "quote_incentives_verification_shape"
    CHECK (
      ("eligibility_status" = 'pending' AND "verified_by" is null AND "verified_at" is null)
      OR
      ("eligibility_status" IN ('verified','ineligible') AND "verified_at" is not null)
    )
);
CREATE UNIQUE INDEX "quote_incentives_org_id_unique"
  ON "quote_incentive_applications" ("organization_id", "id");
CREATE UNIQUE INDEX "quote_incentives_line_program_unique"
  ON "quote_incentive_applications" ("organization_id", "quote_line_id", "program_id");

ALTER TABLE "incentive_programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incentive_programs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "incentive_programs_current_tenant_select"
  ON "incentive_programs" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "incentive_programs_current_tenant_insert"
  ON "incentive_programs" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "incentive_programs_current_tenant_update"
  ON "incentive_programs" FOR UPDATE
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE "quote_incentive_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_incentive_applications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_incentives_current_tenant_select"
  ON "quote_incentive_applications" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_incentives_current_tenant_insert"
  ON "quote_incentive_applications" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_incentives_current_tenant_update"
  ON "quote_incentive_applications" FOR UPDATE
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE FUNCTION validate_quote_incentive_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  line_category text;
  line_total integer;
BEGIN
  SELECT category::text, total_cents
  INTO line_category, line_total
  FROM deal_quote_lines
  WHERE organization_id = NEW.organization_id
    AND quote_id = NEW.quote_id
    AND id = NEW.quote_line_id;

  IF line_category IS DISTINCT FROM 'discount' THEN
    RAISE EXCEPTION 'Incentives may only attach to Quote discount lines';
  END IF;
  IF line_total IS DISTINCT FROM -NEW.amount_cents THEN
    RAISE EXCEPTION 'Incentive amount must exactly match its Quote discount line';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "quote_incentives_validate_discount_line"
  BEFORE INSERT OR UPDATE ON "quote_incentive_applications"
  FOR EACH ROW EXECUTE FUNCTION validate_quote_incentive_line();

CREATE FUNCTION prevent_verified_incentive_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.eligibility_status <> 'pending' THEN
    RAISE EXCEPTION 'Verified or ineligible incentive decisions are immutable';
  END IF;
  IF (NEW.organization_id, NEW.quote_id, NEW.quote_line_id, NEW.program_id, NEW.amount_cents, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.organization_id, OLD.quote_id, OLD.quote_line_id, OLD.program_id, OLD.amount_cents, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Incentive application identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "quote_incentives_guard"
  BEFORE UPDATE ON "quote_incentive_applications"
  FOR EACH ROW EXECUTE FUNCTION prevent_verified_incentive_rewrite();
