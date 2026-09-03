CREATE TABLE "quote_approval_policies" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "always_require_approval" boolean DEFAULT false NOT NULL,
  "discount_threshold_cents" integer,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_approval_policies_same_organization_location_fk"
    FOREIGN KEY ("organization_id", "location_id")
    REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "quote_approval_policies_id_format"
    CHECK ("id" ~ '^qpl_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_approval_policies_version_positive"
    CHECK ("version" > 0),
  CONSTRAINT "quote_approval_policies_discount_threshold_positive"
    CHECK ("discount_threshold_cents" is null OR "discount_threshold_cents" > 0)
);

CREATE UNIQUE INDEX "quote_approval_policies_organization_id_unique"
  ON "quote_approval_policies" ("organization_id", "id");
CREATE UNIQUE INDEX "quote_approval_policies_org_default_unique"
  ON "quote_approval_policies" ("organization_id")
  WHERE "location_id" is null;
CREATE UNIQUE INDEX "quote_approval_policies_org_location_unique"
  ON "quote_approval_policies" ("organization_id", "location_id")
  WHERE "location_id" is not null;
CREATE INDEX "quote_approval_policies_lookup_idx"
  ON "quote_approval_policies" ("organization_id", "location_id", "enabled");

ALTER TABLE "quote_approval_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_approval_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_approval_policies_current_tenant_select"
  ON "quote_approval_policies" FOR SELECT
  USING (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_approval_policies_current_tenant_insert"
  ON "quote_approval_policies" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE POLICY "quote_approval_policies_current_tenant_update"
  ON "quote_approval_policies" FOR UPDATE
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE FUNCTION prevent_quote_approval_policy_scope_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.organization_id, NEW.location_id, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.organization_id, OLD.location_id, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Quote approval policy scope is immutable';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Quote approval policy version must advance by exactly one';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "quote_approval_policies_scope_guard"
  BEFORE UPDATE ON "quote_approval_policies"
  FOR EACH ROW EXECUTE FUNCTION prevent_quote_approval_policy_scope_rewrite();
