CREATE TABLE "inventory_unit_media" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "vehicle_id" text NOT NULL,
  "inventory_unit_id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_asset_id" text NOT NULL,
  "delivery_url" text NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "sha256" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "alt_text" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "captured_at" timestamptz,
  "verified_at" timestamptz NOT NULL,
  "verified_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" text DEFAULT 'active' NOT NULL,
  "removed_at" timestamptz,
  "removed_by" text REFERENCES "users"("id") ON DELETE RESTRICT,
  "removal_reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_unit_media_exact_unit_fk" FOREIGN KEY ("organization_id","location_id","vehicle_id","inventory_unit_id") REFERENCES "inventory_units"("organization_id","location_id","vehicle_id","id"),
  CONSTRAINT "inventory_unit_media_id_format" CHECK ("id" ~ '^ima_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "inventory_unit_media_provider_format" CHECK ("provider" ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  CONSTRAINT "inventory_unit_media_content_type" CHECK ("content_type" in ('image/jpeg','image/png','image/webp')),
  CONSTRAINT "inventory_unit_media_delivery_url" CHECK ("delivery_url" ~ '^https://[^[:space:]]+$'),
  CONSTRAINT "inventory_unit_media_sha256" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "inventory_unit_media_dimensions" CHECK ("byte_size" between 1 and 52428800 and "width" between 1 and 20000 and "height" between 1 and 20000),
  CONSTRAINT "inventory_unit_media_alt_text" CHECK (length(trim("alt_text")) between 1 and 300),
  CONSTRAINT "inventory_unit_media_sort_order" CHECK ("sort_order" between 0 and 1000),
  CONSTRAINT "inventory_unit_media_status" CHECK ("status" in ('active','removed')),
  CONSTRAINT "inventory_unit_media_removal_consistency" CHECK (("status"='removed')=("removed_at" is not null and "removed_by" is not null and "removal_reason" is not null)),
  CONSTRAINT "inventory_unit_media_removal_reason" CHECK ("removal_reason" is null or length(trim("removal_reason")) between 1 and 500)
);
CREATE UNIQUE INDEX "inventory_unit_media_organization_id_unique" ON "inventory_unit_media"("organization_id","id");
CREATE UNIQUE INDEX "inventory_unit_media_provider_asset_unique" ON "inventory_unit_media"("organization_id","provider","provider_asset_id");
CREATE INDEX "inventory_unit_media_inventory_order_idx" ON "inventory_unit_media"("organization_id","inventory_unit_id","status","sort_order");

ALTER TABLE "inventory_unit_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_unit_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inventory_unit_media_current_tenant_select" ON "inventory_unit_media" FOR SELECT USING ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "inventory_unit_media_current_tenant_insert" ON "inventory_unit_media" FOR INSERT WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY "inventory_unit_media_current_tenant_update" ON "inventory_unit_media" FOR UPDATE USING ("organization_id"=nullif(current_setting('app.organization_id',true),'')) WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION prevent_inventory_media_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.organization_id<>OLD.organization_id OR NEW.location_id<>OLD.location_id OR NEW.vehicle_id<>OLD.vehicle_id OR NEW.inventory_unit_id<>OLD.inventory_unit_id OR NEW.provider<>OLD.provider OR NEW.provider_asset_id<>OLD.provider_asset_id OR NEW.delivery_url<>OLD.delivery_url OR NEW.content_type<>OLD.content_type OR NEW.byte_size<>OLD.byte_size OR NEW.sha256<>OLD.sha256 OR NEW.width<>OLD.width OR NEW.height<>OLD.height OR NEW.verified_at<>OLD.verified_at OR NEW.verified_by<>OLD.verified_by THEN
    RAISE EXCEPTION 'inventory media authority is immutable';
  END IF;
  IF OLD.status='removed' THEN RAISE EXCEPTION 'removed inventory media is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "inventory_unit_media_authority_guard" BEFORE UPDATE ON "inventory_unit_media" FOR EACH ROW EXECUTE FUNCTION prevent_inventory_media_authority_rewrite();
