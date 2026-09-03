CREATE TYPE "backend_product_type" AS ENUM (
  'service-contract',
  'gap',
  'maintenance',
  'tire-wheel',
  'appearance',
  'key-replacement',
  'accessory',
  'other'
);

CREATE TABLE "backend_product_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "product_type" "backend_product_type" NOT NULL,
  "quote_line_category" "quote_line_category" NOT NULL,
  "provider_name" text,
  "active" boolean DEFAULT true NOT NULL,
  "default_cost_cents" integer,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "backend_product_catalog_same_organization_location_fk"
    FOREIGN KEY ("organization_id", "location_id")
    REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "backend_product_catalog_id_format"
    CHECK ("id" ~ '^bpc_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "backend_product_catalog_code_length"
    CHECK (char_length(trim("code")) BETWEEN 1 AND 100),
  CONSTRAINT "backend_product_catalog_name_length"
    CHECK (char_length(trim("name")) BETWEEN 1 AND 200),
  CONSTRAINT "backend_product_catalog_provider_length"
    CHECK ("provider_name" is null OR char_length("provider_name") <= 200),
  CONSTRAINT "backend_product_catalog_cost_nonnegative"
    CHECK ("default_cost_cents" is null OR "default_cost_cents" >= 0),
  CONSTRAINT "backend_product_catalog_line_category"
    CHECK ("quote_line_category" IN ('product','accessory'))
);
CREATE UNIQUE INDEX "backend_product_catalog_org_id_unique"
  ON "backend_product_catalog" ("organization_id", "id");
CREATE UNIQUE INDEX "backend_product_catalog_scope_code_unique"
  ON "backend_product_catalog" ("organization_id", coalesce("location_id", ''), "code");

CREATE TABLE "quote_backend_product_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "quote_line_id" text NOT NULL,
  "product_id" text NOT NULL,
  "sell_cents" integer NOT NULL,
  "cost_cents" integer NOT NULL,
  "gross_cents" integer NOT NULL,
  "captured_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "captured_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_backend_snapshots_same_organization_quote_fk"
    FOREIGN KEY ("organization_id", "quote_id")
    REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "quote_backend_snapshots_same_organization_line_fk"
    FOREIGN KEY ("organization_id", "quote_id", "quote_line_id")
    REFERENCES "deal_quote_lines"("organization_id", "quote_id", "id"),
  CONSTRAINT "quote_backend_snapshots_same_organization_product_fk"
    FOREIGN KEY ("organization_id", "product_id")
    REFERENCES "backend_product_catalog"("organization_id", "id"),
  CONSTRAINT "quote_backend_snapshots_id_format"
    CHECK ("id" ~ '^qbp_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_backend_snapshots_amounts"
    CHECK ("sell_cents" >= 0 AND "cost_cents" >= 0),
  CONSTRAINT "quote_backend_snapshots_gross_consistent"
    CHECK ("gross_cents" = "sell_cents" - "cost_cents")
);
CREATE UNIQUE INDEX "quote_backend_snapshots_org_id_unique"
  ON "quote_backend_product_snapshots" ("organization_id", "id");
CREATE UNIQUE INDEX "quote_backend_snapshots_line_unique"
  ON "quote_backend_product_snapshots" ("organization_id", "quote_line_id");

ALTER TABLE "backend_product_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backend_product_catalog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "backend_product_catalog_current_tenant_select"
  ON "backend_product_catalog" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "backend_product_catalog_current_tenant_insert"
  ON "backend_product_catalog" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "backend_product_catalog_current_tenant_update"
  ON "backend_product_catalog" FOR UPDATE
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE "quote_backend_product_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_backend_product_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_backend_snapshots_current_tenant_select"
  ON "quote_backend_product_snapshots" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_backend_snapshots_current_tenant_insert"
  ON "quote_backend_product_snapshots" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE FUNCTION validate_quote_backend_product_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  line_category text;
  line_total integer;
  catalog_category text;
BEGIN
  SELECT category::text, total_cents
  INTO line_category, line_total
  FROM deal_quote_lines
  WHERE organization_id = NEW.organization_id
    AND quote_id = NEW.quote_id
    AND id = NEW.quote_line_id;

  SELECT quote_line_category::text
  INTO catalog_category
  FROM backend_product_catalog
  WHERE organization_id = NEW.organization_id
    AND id = NEW.product_id;

  IF line_category NOT IN ('product','accessory') THEN
    RAISE EXCEPTION 'Backend products may only attach to product or accessory Quote lines';
  END IF;
  IF catalog_category IS DISTINCT FROM line_category THEN
    RAISE EXCEPTION 'Backend product catalog category does not match Quote line category';
  END IF;
  IF line_total IS DISTINCT FROM NEW.sell_cents THEN
    RAISE EXCEPTION 'Backend product sell amount must exactly match Quote line total';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "quote_backend_snapshots_validate_line"
  BEFORE INSERT ON "quote_backend_product_snapshots"
  FOR EACH ROW EXECUTE FUNCTION validate_quote_backend_product_snapshot();

CREATE FUNCTION prevent_quote_backend_snapshot_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quote backend product snapshots are immutable; create a new Quote version';
END $$;
CREATE TRIGGER "quote_backend_snapshots_immutable"
  BEFORE UPDATE OR DELETE ON "quote_backend_product_snapshots"
  FOR EACH ROW EXECUTE FUNCTION prevent_quote_backend_snapshot_rewrite();
