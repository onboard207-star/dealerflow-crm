CREATE TABLE "vehicle_catalog_releases" (
  "id" text PRIMARY KEY NOT NULL,
  "source_system" text NOT NULL,
  "source_dataset" text NOT NULL,
  "source_revision" text NOT NULL,
  "manifest_sha256" text NOT NULL,
  "manifest" jsonb NOT NULL,
  "status" text DEFAULT 'staged' NOT NULL,
  "record_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_releases_id_format" CHECK ("id" ~ '^vcr_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "vehicle_catalog_releases_source" CHECK (char_length(trim("source_system")) BETWEEN 1 AND 64 AND char_length(trim("source_dataset")) BETWEEN 1 AND 200),
  CONSTRAINT "vehicle_catalog_releases_revision" CHECK (char_length(trim("source_revision")) BETWEEN 1 AND 200),
  CONSTRAINT "vehicle_catalog_releases_sha256" CHECK ("manifest_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "vehicle_catalog_releases_manifest" CHECK (jsonb_typeof("manifest")='object'),
  CONSTRAINT "vehicle_catalog_releases_status" CHECK ("status" IN ('staged','accepted','rejected','superseded')),
  CONSTRAINT "vehicle_catalog_releases_completion" CHECK (("status"='staged')=("completed_at" IS NULL))
);
CREATE UNIQUE INDEX "vehicle_catalog_releases_source_revision_unique" ON "vehicle_catalog_releases" ("source_system","source_dataset","source_revision");
CREATE UNIQUE INDEX "vehicle_catalog_releases_manifest_unique" ON "vehicle_catalog_releases" ("manifest_sha256");

CREATE TABLE "vehicle_catalog_makes" (
  "id" text PRIMARY KEY NOT NULL,
  "stable_key" text NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_system" text NOT NULL,
  "source_record_id" text,
  "content_sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_makes_id_format" CHECK ("id" ~ '^vma_[a-f0-9]{32}$'),
  CONSTRAINT "vehicle_catalog_makes_stable_key" CHECK ("stable_key" ~ '^[A-Z0-9][A-Z0-9_-]{2,99}$'),
  CONSTRAINT "vehicle_catalog_makes_name" CHECK (char_length(trim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "vehicle_catalog_makes_status" CHECK ("status" IN ('active','inactive')),
  CONSTRAINT "vehicle_catalog_makes_sha256" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "vehicle_catalog_makes_stable_key_unique" ON "vehicle_catalog_makes" ("stable_key");

CREATE TABLE "vehicle_catalog_models" (
  "id" text PRIMARY KEY NOT NULL,
  "make_id" text NOT NULL REFERENCES "vehicle_catalog_makes"("id") ON DELETE RESTRICT,
  "stable_key" text NOT NULL,
  "name" text NOT NULL,
  "vehicle_class" text,
  "status" text DEFAULT 'active' NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_system" text NOT NULL,
  "source_record_id" text,
  "content_sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_models_id_format" CHECK ("id" ~ '^vmo_[a-f0-9]{32}$'),
  CONSTRAINT "vehicle_catalog_models_stable_key" CHECK ("stable_key" ~ '^[A-Z0-9][A-Z0-9_-]{2,119}$'),
  CONSTRAINT "vehicle_catalog_models_name" CHECK (char_length(trim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "vehicle_catalog_models_status" CHECK ("status" IN ('active','inactive')),
  CONSTRAINT "vehicle_catalog_models_sha256" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "vehicle_catalog_models_stable_key_unique" ON "vehicle_catalog_models" ("stable_key");
CREATE INDEX "vehicle_catalog_models_make_idx" ON "vehicle_catalog_models" ("make_id","name");

CREATE TABLE "vehicle_catalog_model_years" (
  "id" text PRIMARY KEY NOT NULL,
  "model_id" text NOT NULL REFERENCES "vehicle_catalog_models"("id") ON DELETE RESTRICT,
  "stable_key" text NOT NULL,
  "year" integer NOT NULL,
  "generation" text,
  "readiness" text DEFAULT 'needs-review' NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_system" text NOT NULL,
  "source_record_id" text,
  "content_sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_model_years_id_format" CHECK ("id" ~ '^vmy_[a-f0-9]{32}$'),
  CONSTRAINT "vehicle_catalog_model_years_stable_key" CHECK ("stable_key" ~ '^[A-Z0-9][A-Z0-9_-]{2,139}$'),
  CONSTRAINT "vehicle_catalog_model_years_year" CHECK ("year" BETWEEN 1886 AND 2200),
  CONSTRAINT "vehicle_catalog_model_years_readiness" CHECK ("readiness" IN ('needs-review','in-progress','verified','pilot-ready','not-applicable')),
  CONSTRAINT "vehicle_catalog_model_years_sha256" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "vehicle_catalog_model_years_stable_key_unique" ON "vehicle_catalog_model_years" ("stable_key");
CREATE UNIQUE INDEX "vehicle_catalog_model_years_model_year_unique" ON "vehicle_catalog_model_years" ("model_id","year");

CREATE TABLE "vehicle_catalog_trims" (
  "id" text PRIMARY KEY NOT NULL,
  "model_year_id" text NOT NULL REFERENCES "vehicle_catalog_model_years"("id") ON DELETE RESTRICT,
  "stable_key" text NOT NULL,
  "name" text NOT NULL,
  "badge" text,
  "readiness" text DEFAULT 'needs-review' NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_system" text NOT NULL,
  "source_record_id" text,
  "content_sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_trims_id_format" CHECK ("id" ~ '^vtr_[a-f0-9]{32}$'),
  CONSTRAINT "vehicle_catalog_trims_stable_key" CHECK ("stable_key" ~ '^[A-Z0-9][A-Z0-9_-]{2,179}$'),
  CONSTRAINT "vehicle_catalog_trims_name" CHECK (char_length(trim("name")) BETWEEN 1 AND 120),
  CONSTRAINT "vehicle_catalog_trims_readiness" CHECK ("readiness" IN ('needs-review','in-progress','verified','pilot-ready','not-applicable')),
  CONSTRAINT "vehicle_catalog_trims_sha256" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "vehicle_catalog_trims_stable_key_unique" ON "vehicle_catalog_trims" ("stable_key");
CREATE INDEX "vehicle_catalog_trims_model_year_idx" ON "vehicle_catalog_trims" ("model_year_id","name");

CREATE TABLE "vehicle_catalog_configurations" (
  "id" text PRIMARY KEY NOT NULL,
  "trim_id" text NOT NULL REFERENCES "vehicle_catalog_trims"("id") ON DELETE RESTRICT,
  "stable_key" text NOT NULL,
  "name" text NOT NULL,
  "drivetrain" text,
  "powertrain" text,
  "engine" text,
  "transmission" text,
  "body_style" text,
  "seat_count" integer,
  "readiness" text DEFAULT 'needs-review' NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_system" text NOT NULL,
  "source_record_id" text,
  "content_sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_configurations_id_format" CHECK ("id" ~ '^vcf_[a-f0-9]{32}$'),
  CONSTRAINT "vehicle_catalog_configurations_stable_key" CHECK ("stable_key" ~ '^[A-Z0-9][A-Z0-9_-]{2,219}$'),
  CONSTRAINT "vehicle_catalog_configurations_name" CHECK (char_length(trim("name")) BETWEEN 1 AND 200),
  CONSTRAINT "vehicle_catalog_configurations_seats" CHECK ("seat_count" IS NULL OR "seat_count" BETWEEN 1 AND 100),
  CONSTRAINT "vehicle_catalog_configurations_readiness" CHECK ("readiness" IN ('needs-review','in-progress','verified','pilot-ready','not-applicable')),
  CONSTRAINT "vehicle_catalog_configurations_sha256" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "vehicle_catalog_configurations_stable_key_unique" ON "vehicle_catalog_configurations" ("stable_key");
CREATE INDEX "vehicle_catalog_configurations_trim_idx" ON "vehicle_catalog_configurations" ("trim_id","readiness");

CREATE TABLE "vehicle_catalog_attributes" (
  "id" text PRIMARY KEY NOT NULL,
  "stable_key" text NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "value" text,
  "unit" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_system" text NOT NULL,
  "source_record_id" text,
  "content_sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_attributes_id_format" CHECK ("id" ~ '^vca_[a-f0-9]{32}$'),
  CONSTRAINT "vehicle_catalog_attributes_stable_key" CHECK ("stable_key" ~ '^[A-Z0-9][A-Z0-9_-]{2,219}$'),
  CONSTRAINT "vehicle_catalog_attributes_kind" CHECK ("kind" IN ('exterior-color','interior-color','feature','package','specification')),
  CONSTRAINT "vehicle_catalog_attributes_name" CHECK (char_length(trim("name")) BETWEEN 1 AND 200),
  CONSTRAINT "vehicle_catalog_attributes_sha256" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "vehicle_catalog_attributes_stable_key_unique" ON "vehicle_catalog_attributes" ("stable_key");
CREATE INDEX "vehicle_catalog_attributes_kind_name_idx" ON "vehicle_catalog_attributes" ("kind","name");

CREATE TABLE "vehicle_catalog_configuration_attributes" (
  "configuration_id" text NOT NULL REFERENCES "vehicle_catalog_configurations"("id") ON DELETE CASCADE,
  "attribute_id" text NOT NULL REFERENCES "vehicle_catalog_attributes"("id") ON DELETE RESTRICT,
  "relationship" text DEFAULT 'standard' NOT NULL,
  "conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_record_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_configuration_attributes_pk" PRIMARY KEY ("configuration_id","attribute_id"),
  CONSTRAINT "vehicle_catalog_configuration_attributes_relationship" CHECK ("relationship" IN ('standard','optional','available','excluded','requires'))
);
CREATE INDEX "vehicle_catalog_configuration_attributes_attribute_idx" ON "vehicle_catalog_configuration_attributes" ("attribute_id","configuration_id");

CREATE TABLE "vehicle_catalog_matches" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "vehicle_id" text NOT NULL,
  "configuration_id" text NOT NULL REFERENCES "vehicle_catalog_configurations"("id") ON DELETE RESTRICT,
  "status" text DEFAULT 'proposed' NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source" text NOT NULL,
  "matched_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "matched_at" timestamptz DEFAULT now() NOT NULL,
  "superseded_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_matches_same_vehicle_fk" FOREIGN KEY ("organization_id","vehicle_id") REFERENCES "vehicles"("organization_id","id") ON DELETE CASCADE,
  CONSTRAINT "vehicle_catalog_matches_id_format" CHECK ("id" ~ '^vcm_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "vehicle_catalog_matches_status" CHECK ("status" IN ('proposed','verified','rejected','superseded')),
  CONSTRAINT "vehicle_catalog_matches_source" CHECK (char_length(trim("source")) BETWEEN 1 AND 100),
  CONSTRAINT "vehicle_catalog_matches_evidence" CHECK (jsonb_typeof("evidence")='array'),
  CONSTRAINT "vehicle_catalog_matches_superseded" CHECK (("status"='superseded')=("superseded_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "vehicle_catalog_matches_org_id_unique" ON "vehicle_catalog_matches" ("organization_id","id");
CREATE UNIQUE INDEX "vehicle_catalog_matches_one_verified" ON "vehicle_catalog_matches" ("organization_id","vehicle_id") WHERE "status"='verified';
CREATE INDEX "vehicle_catalog_matches_configuration_idx" ON "vehicle_catalog_matches" ("configuration_id","status");

ALTER TABLE "vehicle_catalog_releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_releases" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_releases_read" ON "vehicle_catalog_releases" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_releases_import" ON "vehicle_catalog_releases" FOR ALL
  USING (nullif(current_setting('app.vehicle_catalog_import', true),'')='enabled')
  WITH CHECK (nullif(current_setting('app.vehicle_catalog_import', true),'')='enabled');

ALTER TABLE "vehicle_catalog_makes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_makes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_makes_read" ON "vehicle_catalog_makes" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_makes_import" ON "vehicle_catalog_makes" FOR ALL USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled') WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');
ALTER TABLE "vehicle_catalog_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_models" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_models_read" ON "vehicle_catalog_models" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_models_import" ON "vehicle_catalog_models" FOR ALL USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled') WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');
ALTER TABLE "vehicle_catalog_model_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_model_years" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_model_years_read" ON "vehicle_catalog_model_years" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_model_years_import" ON "vehicle_catalog_model_years" FOR ALL USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled') WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');
ALTER TABLE "vehicle_catalog_trims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_trims" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_trims_read" ON "vehicle_catalog_trims" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_trims_import" ON "vehicle_catalog_trims" FOR ALL USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled') WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');
ALTER TABLE "vehicle_catalog_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_configurations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_configurations_read" ON "vehicle_catalog_configurations" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_configurations_import" ON "vehicle_catalog_configurations" FOR ALL USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled') WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');
ALTER TABLE "vehicle_catalog_attributes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_attributes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_attributes_read" ON "vehicle_catalog_attributes" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_attributes_import" ON "vehicle_catalog_attributes" FOR ALL USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled') WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');
ALTER TABLE "vehicle_catalog_configuration_attributes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_configuration_attributes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_configuration_attributes_read" ON "vehicle_catalog_configuration_attributes" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_configuration_attributes_import" ON "vehicle_catalog_configuration_attributes" FOR ALL USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled') WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');

ALTER TABLE "vehicle_catalog_matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_matches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_matches_current_tenant_select" ON "vehicle_catalog_matches" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "vehicle_catalog_matches_current_tenant_insert" ON "vehicle_catalog_matches" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "vehicle_catalog_matches_current_tenant_update" ON "vehicle_catalog_matches" FOR UPDATE USING ("organization_id"=nullif(current_setting('app.organization_id',true),'')) WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION prevent_vehicle_catalog_match_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id<>OLD.organization_id OR NEW.vehicle_id<>OLD.vehicle_id OR NEW.configuration_id<>OLD.configuration_id OR NEW.matched_by IS DISTINCT FROM OLD.matched_by OR NEW.matched_at<>OLD.matched_at THEN
    RAISE EXCEPTION 'vehicle catalog match authority is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "vehicle_catalog_matches_authority_immutable" BEFORE UPDATE ON "vehicle_catalog_matches" FOR EACH ROW EXECUTE FUNCTION prevent_vehicle_catalog_match_authority_rewrite();
