CREATE TABLE "inventory_media_uploads" (
  "id" text PRIMARY KEY NOT NULL,"organization_id" text NOT NULL,"location_id" text NOT NULL,"vehicle_id" text NOT NULL,"inventory_unit_id" text NOT NULL,
  "object_key" text NOT NULL,"original_filename" text NOT NULL,"content_type" text NOT NULL,"expected_byte_size" integer NOT NULL,"alt_text" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,"expires_at" timestamptz NOT NULL,"completed_at" timestamptz,"media_id" text,"idempotency_key" text NOT NULL,
  "initiated_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_media_uploads_exact_unit_fk" FOREIGN KEY("organization_id","location_id","vehicle_id","inventory_unit_id") REFERENCES "inventory_units"("organization_id","location_id","vehicle_id","id"),
  CONSTRAINT "inventory_media_uploads_same_media_fk" FOREIGN KEY("organization_id","media_id") REFERENCES "inventory_unit_media"("organization_id","id"),
  CONSTRAINT "inventory_media_uploads_id_format" CHECK("id"~'^imu_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "inventory_media_uploads_object_key" CHECK("object_key"~'^organizations/org_[a-z0-9_-]{6,64}/inventory/inv_[a-z0-9_-]{6,64}/[a-z0-9_-]{16,80}\.(jpg|png|webp)$'),
  CONSTRAINT "inventory_media_uploads_filename" CHECK(length(trim("original_filename")) between 1 and 255),
  CONSTRAINT "inventory_media_uploads_content_type" CHECK("content_type" in ('image/jpeg','image/png','image/webp')),
  CONSTRAINT "inventory_media_uploads_byte_size" CHECK("expected_byte_size" between 1 and 20971520),
  CONSTRAINT "inventory_media_uploads_alt_text" CHECK(length(trim("alt_text")) between 1 and 300),
  CONSTRAINT "inventory_media_uploads_status" CHECK("status" in ('pending','completed','expired','failed')),
  CONSTRAINT "inventory_media_uploads_completion" CHECK(("status"='completed')=("completed_at" is not null and "media_id" is not null)),
  CONSTRAINT "inventory_media_uploads_expiry" CHECK("expires_at">"created_at")
);
CREATE UNIQUE INDEX "inventory_media_uploads_organization_id_unique" ON "inventory_media_uploads"("organization_id","id");
CREATE UNIQUE INDEX "inventory_media_uploads_object_key_unique" ON "inventory_media_uploads"("object_key");
CREATE UNIQUE INDEX "inventory_media_uploads_idempotency_unique" ON "inventory_media_uploads"("organization_id","idempotency_key");
CREATE INDEX "inventory_media_uploads_pending_idx" ON "inventory_media_uploads"("organization_id","inventory_unit_id","status","expires_at");
ALTER TABLE "inventory_media_uploads" ENABLE ROW LEVEL SECURITY;ALTER TABLE "inventory_media_uploads" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inventory_media_uploads_current_tenant_select" ON "inventory_media_uploads" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "inventory_media_uploads_current_tenant_insert" ON "inventory_media_uploads" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "inventory_media_uploads_current_tenant_update" ON "inventory_media_uploads" FOR UPDATE USING("organization_id"=nullif(current_setting('app.organization_id',true),'')) WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE FUNCTION prevent_inventory_upload_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.organization_id<>OLD.organization_id OR NEW.location_id<>OLD.location_id OR NEW.vehicle_id<>OLD.vehicle_id OR NEW.inventory_unit_id<>OLD.inventory_unit_id OR NEW.object_key<>OLD.object_key OR NEW.original_filename<>OLD.original_filename OR NEW.content_type<>OLD.content_type OR NEW.expected_byte_size<>OLD.expected_byte_size OR NEW.alt_text<>OLD.alt_text OR NEW.expires_at<>OLD.expires_at OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.initiated_by<>OLD.initiated_by THEN RAISE EXCEPTION 'inventory upload authority is immutable';END IF;
  IF OLD.status<>'pending' THEN RAISE EXCEPTION 'terminal inventory upload is immutable';END IF;RETURN NEW;
END $$;
CREATE TRIGGER "inventory_media_uploads_authority_guard" BEFORE UPDATE ON "inventory_media_uploads" FOR EACH ROW EXECUTE FUNCTION prevent_inventory_upload_authority_rewrite();
