CREATE TABLE "import_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE restrict,
  "domain" text NOT NULL,
  "source_name" text NOT NULL,
  "source_checksum" text NOT NULL,
  "mapping" jsonb NOT NULL,
  "status" text NOT NULL,
  "total_rows" integer NOT NULL,
  "valid_rows" integer NOT NULL,
  "rejected_rows" integer NOT NULL,
  "duplicate_rows" integer NOT NULL,
  "unresolved_rows" integer NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "import_batches_id_format" CHECK ("id" ~ '^imb_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "import_batches_domain" CHECK ("domain" in ('customer-lead','inventory','user')),
  CONSTRAINT "import_batches_status" CHECK ("status" in ('review-required','ready','completed','failed','aborted')),
  CONSTRAINT "import_batches_checksum" CHECK ("source_checksum" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "import_batches_source_name_length" CHECK (char_length(trim("source_name")) between 1 and 255),
  CONSTRAINT "import_batches_idempotency_length" CHECK (char_length(trim("idempotency_key")) between 1 and 200),
  CONSTRAINT "import_batches_counts" CHECK ("total_rows" between 1 and 10000 and "valid_rows">=0 and "rejected_rows">=0 and "duplicate_rows">=0 and "unresolved_rows">=0 and "valid_rows"+"rejected_rows"+"duplicate_rows"+"unresolved_rows"="total_rows")
);
CREATE UNIQUE INDEX "import_batches_organization_id_unique" ON "import_batches"("organization_id","id");
CREATE UNIQUE INDEX "import_batches_idempotency_unique" ON "import_batches"("organization_id","idempotency_key");
CREATE INDEX "import_batches_status_idx" ON "import_batches"("organization_id","status","created_at");

CREATE TABLE "import_batch_rows" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "batch_id" text NOT NULL,
  "row_number" integer NOT NULL,
  "status" text NOT NULL,
  "canonical" jsonb NOT NULL,
  "issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "import_batch_rows_same_batch_fk" FOREIGN KEY ("organization_id","batch_id") REFERENCES "import_batches"("organization_id","id") ON DELETE restrict,
  CONSTRAINT "import_batch_rows_id_format" CHECK ("id" ~ '^imr_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "import_batch_rows_number" CHECK ("row_number" between 1 and 10000),
  CONSTRAINT "import_batch_rows_status" CHECK ("status" in ('valid','rejected','duplicate','needs-review'))
);
CREATE UNIQUE INDEX "import_batch_rows_organization_id_unique" ON "import_batch_rows"("organization_id","id");
CREATE UNIQUE INDEX "import_batch_rows_number_unique" ON "import_batch_rows"("organization_id","batch_id","row_number");

ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "import_batches_tenant_isolation" ON "import_batches" USING ("organization_id"=current_setting('app.organization_id',true)) WITH CHECK ("organization_id"=current_setting('app.organization_id',true));
ALTER TABLE "import_batch_rows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batch_rows" FORCE ROW LEVEL SECURITY;
CREATE POLICY "import_batch_rows_tenant_isolation" ON "import_batch_rows" USING ("organization_id"=current_setting('app.organization_id',true)) WITH CHECK ("organization_id"=current_setting('app.organization_id',true));

CREATE FUNCTION prevent_import_batch_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Import batch evidence cannot be deleted'; END IF;
  IF NEW."organization_id"<>OLD."organization_id" OR NEW."domain"<>OLD."domain" OR NEW."source_name"<>OLD."source_name" OR NEW."source_checksum"<>OLD."source_checksum" OR NEW."mapping"<>OLD."mapping" OR NEW."idempotency_key"<>OLD."idempotency_key" OR NEW."created_by"<>OLD."created_by" OR NEW."created_at"<>OLD."created_at" THEN RAISE EXCEPTION 'Import batch authority is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "import_batches_authority_immutable" BEFORE UPDATE OR DELETE ON "import_batches" FOR EACH ROW EXECUTE FUNCTION prevent_import_batch_authority_rewrite();

CREATE FUNCTION prevent_import_batch_row_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Import batch rows are immutable'; END $$;
CREATE TRIGGER "import_batch_rows_immutable" BEFORE UPDATE OR DELETE ON "import_batch_rows" FOR EACH ROW EXECUTE FUNCTION prevent_import_batch_row_mutation();
