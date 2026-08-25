CREATE TYPE "quote_status" AS ENUM ('draft','presented','accepted','rejected','expired');
CREATE TYPE "quote_line_category" AS ENUM ('vehicle','product','accessory','fee','tax','discount');

CREATE TABLE "deal_quotes" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "deal_id" text NOT NULL,
  "version" integer NOT NULL, "status" "quote_status" DEFAULT 'draft' NOT NULL, "purchase_type" "purchase_type" NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL, "subtotal_cents" integer NOT NULL,
  "fee_cents" integer NOT NULL, "tax_cents" integer NOT NULL, "discount_cents" integer NOT NULL,
  "total_cents" integer NOT NULL, "expires_at" timestamptz, "presented_at" timestamptz, "accepted_at" timestamptz,
  "idempotency_key" text NOT NULL, "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "deal_quotes_same_organization_deal_fk" FOREIGN KEY ("organization_id", "deal_id") REFERENCES "deals"("organization_id", "id"),
  CONSTRAINT "deal_quotes_id_format" CHECK ("id" ~ '^quo_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deal_quotes_version_positive" CHECK ("version" > 0),
  CONSTRAINT "deal_quotes_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "deal_quotes_totals_consistent" CHECK ("total_cents" = "subtotal_cents" + "fee_cents" + "tax_cents" + "discount_cents"),
  CONSTRAINT "deal_quotes_nonnegative_total" CHECK ("subtotal_cents" >= 0 and "fee_cents" >= 0 and "tax_cents" >= 0 and "discount_cents" <= 0 and "total_cents" >= 0)
);
CREATE UNIQUE INDEX "deal_quotes_organization_id_unique" ON "deal_quotes" ("organization_id", "id");
CREATE UNIQUE INDEX "deal_quotes_deal_version_unique" ON "deal_quotes" ("organization_id", "deal_id", "version");
CREATE UNIQUE INDEX "deal_quotes_organization_idempotency_unique" ON "deal_quotes" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "deal_quotes_one_accepted_unique" ON "deal_quotes" ("organization_id", "deal_id") WHERE "status" = 'accepted';
CREATE INDEX "deal_quotes_deal_status_idx" ON "deal_quotes" ("organization_id", "deal_id", "status");

CREATE TABLE "deal_quote_lines" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "quote_id" text NOT NULL,
  "position" integer NOT NULL, "category" "quote_line_category" NOT NULL, "description" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL, "unit_amount_cents" integer NOT NULL, "total_cents" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "deal_quote_lines_same_organization_quote_fk" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "deal_quote_lines_id_format" CHECK ("id" ~ '^qli_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deal_quote_lines_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "deal_quote_lines_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "deal_quote_lines_total_consistent" CHECK ("total_cents" = "quantity" * "unit_amount_cents"),
  CONSTRAINT "deal_quote_lines_sign" CHECK (("category" = 'discount' and "unit_amount_cents" <= 0) or ("category" <> 'discount' and "unit_amount_cents" >= 0)),
  CONSTRAINT "deal_quote_lines_description_length" CHECK (char_length("description") between 1 and 500)
);
CREATE UNIQUE INDEX "deal_quote_lines_organization_id_unique" ON "deal_quote_lines" ("organization_id", "id");
CREATE UNIQUE INDEX "deal_quote_lines_quote_position_unique" ON "deal_quote_lines" ("organization_id", "quote_id", "position");

CREATE TABLE "deal_quote_status_events" (
  "id" text PRIMARY KEY NOT NULL, "organization_id" text NOT NULL, "quote_id" text NOT NULL,
  "from_status" "quote_status", "to_status" "quote_status" NOT NULL, "reason" text,
  "idempotency_key" text NOT NULL, "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "quote_status_events_same_organization_quote_fk" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "deal_quotes"("organization_id", "id"),
  CONSTRAINT "quote_status_events_id_format" CHECK ("id" ~ '^qst_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_status_events_changed" CHECK ("from_status" is null or "from_status" <> "to_status"),
  CONSTRAINT "quote_status_events_reason_length" CHECK ("reason" is null or char_length("reason") <= 1000)
);
CREATE UNIQUE INDEX "quote_status_events_organization_id_unique" ON "deal_quote_status_events" ("organization_id", "id");
CREATE UNIQUE INDEX "quote_status_events_organization_idempotency_unique" ON "deal_quote_status_events" ("organization_id", "idempotency_key");
CREATE INDEX "quote_status_events_quote_time_idx" ON "deal_quote_status_events" ("organization_id", "quote_id", "occurred_at");

ALTER TABLE "deal_quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_quotes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deal_quotes_current_tenant_select" ON "deal_quotes" FOR SELECT USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "deal_quotes_current_tenant_insert" ON "deal_quotes" FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "deal_quotes_current_tenant_update" ON "deal_quotes" FOR UPDATE USING (organization_id = current_setting('app.organization_id', true)) WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE FUNCTION prevent_quote_financial_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.organization_id, NEW.deal_id, NEW.version, NEW.purchase_type, NEW.currency, NEW.subtotal_cents,
      NEW.fee_cents, NEW.tax_cents, NEW.discount_cents, NEW.total_cents, NEW.idempotency_key)
     IS DISTINCT FROM
     (OLD.organization_id, OLD.deal_id, OLD.version, OLD.purchase_type, OLD.currency, OLD.subtotal_cents,
      OLD.fee_cents, OLD.tax_cents, OLD.discount_cents, OLD.total_cents, OLD.idempotency_key) THEN
    RAISE EXCEPTION 'Quote financial versions are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "deal_quotes_immutable_financials" BEFORE UPDATE ON "deal_quotes"
  FOR EACH ROW EXECUTE FUNCTION prevent_quote_financial_rewrite();
ALTER TABLE "deal_quote_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deal_quote_lines_current_tenant_select" ON "deal_quote_lines" FOR SELECT USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "deal_quote_lines_current_tenant_insert" ON "deal_quote_lines" FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true));
ALTER TABLE "deal_quote_status_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_status_events_current_tenant_select" ON "deal_quote_status_events" FOR SELECT USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_status_events_current_tenant_insert" ON "deal_quote_status_events" FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true));
