CREATE TABLE "organization_configuration_versions" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "configuration" jsonb NOT NULL,
  "change_kind" text NOT NULL,
  "restored_from_id" text,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "configuration_versions_id_format" CHECK ("id" ~ '^ocv_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "configuration_versions_change_kind" CHECK ("change_kind" IN ('update','rollback')),
  CONSTRAINT "configuration_versions_snapshot_object" CHECK (jsonb_typeof("configuration")='object'),
  CONSTRAINT "configuration_versions_restore_consistency" CHECK (("change_kind"='rollback')=("restored_from_id" IS NOT NULL)),
  CONSTRAINT "configuration_versions_same_org_restore_fk" FOREIGN KEY ("organization_id","restored_from_id") REFERENCES "organization_configuration_versions"("organization_id","id")
);
CREATE UNIQUE INDEX "configuration_versions_organization_id_unique" ON "organization_configuration_versions"("organization_id","id");
CREATE INDEX "configuration_versions_created_idx" ON "organization_configuration_versions"("organization_id","created_at" DESC);
ALTER TABLE "organization_configuration_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_configuration_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "configuration_versions_current_tenant" ON "organization_configuration_versions" USING ("organization_id"=nullif(current_setting('app.organization_id',true),'')) WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE FUNCTION prevent_configuration_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'configuration versions are immutable'; END $$;
CREATE TRIGGER "configuration_versions_immutable" BEFORE UPDATE OR DELETE ON "organization_configuration_versions" FOR EACH ROW EXECUTE FUNCTION prevent_configuration_version_mutation();
