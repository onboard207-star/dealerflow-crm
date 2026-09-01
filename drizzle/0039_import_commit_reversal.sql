ALTER TABLE "import_batches" DROP CONSTRAINT "import_batches_status";
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_status" CHECK ("status" in ('review-required','ready','completed','failed','aborted','reversed'));

CREATE TABLE "import_applied_records" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "batch_id" text NOT NULL,
  "row_number" integer NOT NULL,
  "entity_kind" text NOT NULL,
  "entity_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reversed_at" timestamp with time zone,
  "reversed_by" text REFERENCES "users"("id") ON DELETE restrict,
  CONSTRAINT "import_applied_records_same_batch_fk" FOREIGN KEY ("organization_id","batch_id") REFERENCES "import_batches"("organization_id","id") ON DELETE restrict,
  CONSTRAINT "import_applied_records_id_format" CHECK ("id" ~ '^iar_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "import_applied_records_row_number" CHECK ("row_number" between 1 and 10000),
  CONSTRAINT "import_applied_records_entity_kind" CHECK ("entity_kind" in ('customer','lead','vehicle','inventory-unit')),
  CONSTRAINT "import_applied_records_reversal" CHECK (("reversed_at" is null)=("reversed_by" is null))
);
CREATE UNIQUE INDEX "import_applied_records_organization_id_unique" ON "import_applied_records"("organization_id","id");
CREATE UNIQUE INDEX "import_applied_records_entity_unique" ON "import_applied_records"("organization_id","batch_id","entity_kind","entity_id");
CREATE INDEX "import_applied_records_batch_row_idx" ON "import_applied_records"("organization_id","batch_id","row_number");

ALTER TABLE "import_applied_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_applied_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "import_applied_records_tenant_isolation" ON "import_applied_records" USING ("organization_id"=current_setting('app.organization_id',true)) WITH CHECK ("organization_id"=current_setting('app.organization_id',true));

CREATE FUNCTION prevent_import_applied_record_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Import applied-record evidence cannot be deleted'; END IF;
  IF NEW."organization_id"<>OLD."organization_id" OR NEW."batch_id"<>OLD."batch_id" OR NEW."row_number"<>OLD."row_number" OR NEW."entity_kind"<>OLD."entity_kind" OR NEW."entity_id"<>OLD."entity_id" OR NEW."created_at"<>OLD."created_at" THEN RAISE EXCEPTION 'Import applied-record authority is immutable'; END IF;
  IF OLD."reversed_at" IS NOT NULL AND (NEW."reversed_at"<>OLD."reversed_at" OR NEW."reversed_by"<>OLD."reversed_by") THEN RAISE EXCEPTION 'Import reversal evidence is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "import_applied_records_immutable" BEFORE UPDATE OR DELETE ON "import_applied_records" FOR EACH ROW EXECUTE FUNCTION prevent_import_applied_record_rewrite();
