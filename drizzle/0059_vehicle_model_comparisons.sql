CREATE TABLE "vehicle_catalog_model_comparisons" (
  "id" text PRIMARY KEY NOT NULL,
  "stable_key" text NOT NULL,
  "subject_model_id" text NOT NULL REFERENCES "vehicle_catalog_models"("id") ON DELETE RESTRICT,
  "competitor_model_id" text NOT NULL REFERENCES "vehicle_catalog_models"("id") ON DELETE RESTRICT,
  "categories" text[] DEFAULT '{}'::text[] NOT NULL,
  "relationship_status" text DEFAULT 'active' NOT NULL,
  "readiness" text DEFAULT 'needs-review' NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "release_id" text NOT NULL REFERENCES "vehicle_catalog_releases"("id") ON DELETE RESTRICT,
  "source_system" text NOT NULL,
  "source_record_id" text,
  "content_sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_catalog_model_comparisons_id_format" CHECK ("id" ~ '^vcp_[a-f0-9]{32}$'),
  CONSTRAINT "vehicle_catalog_model_comparisons_stable_key" CHECK ("stable_key" ~ '^[A-Z0-9][A-Z0-9_-]{2,219}$'),
  CONSTRAINT "vehicle_catalog_model_comparisons_distinct" CHECK ("subject_model_id" <> "competitor_model_id"),
  CONSTRAINT "vehicle_catalog_model_comparisons_status" CHECK ("relationship_status" IN ('active','inactive','retired')),
  CONSTRAINT "vehicle_catalog_model_comparisons_readiness" CHECK ("readiness" IN ('needs-review','in-progress','verified','pilot-ready','blocked','not-applicable')),
  CONSTRAINT "vehicle_catalog_model_comparisons_evidence" CHECK (jsonb_typeof("evidence")='object'),
  CONSTRAINT "vehicle_catalog_model_comparisons_sha256" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "vehicle_catalog_model_comparisons_stable_key_unique" ON "vehicle_catalog_model_comparisons" ("stable_key");
CREATE INDEX "vehicle_catalog_model_comparisons_subject_idx" ON "vehicle_catalog_model_comparisons" ("subject_model_id","relationship_status","readiness");
CREATE INDEX "vehicle_catalog_model_comparisons_competitor_idx" ON "vehicle_catalog_model_comparisons" ("competitor_model_id","relationship_status","readiness");
CREATE INDEX "vehicle_catalog_model_comparisons_release_idx" ON "vehicle_catalog_model_comparisons" ("release_id");

ALTER TABLE "vehicle_catalog_model_comparisons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_catalog_model_comparisons" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_catalog_model_comparisons_read" ON "vehicle_catalog_model_comparisons" FOR SELECT USING (true);
CREATE POLICY "vehicle_catalog_model_comparisons_import" ON "vehicle_catalog_model_comparisons" FOR ALL
  USING (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled')
  WITH CHECK (nullif(current_setting('app.vehicle_catalog_import',true),'')='enabled');
