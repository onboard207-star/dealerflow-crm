ALTER TABLE "inventory_unit_media" ADD COLUMN "source_type" text DEFAULT 'actual' NOT NULL;
ALTER TABLE "inventory_unit_media" ADD COLUMN "media_type" text DEFAULT 'image' NOT NULL;
ALTER TABLE "inventory_unit_media" ADD COLUMN "original_filename" text;
ALTER TABLE "inventory_unit_media" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;

UPDATE "inventory_unit_media" media
SET "original_filename" = upload."original_filename"
FROM "inventory_media_uploads" upload
WHERE upload."organization_id" = media."organization_id" AND upload."media_id" = media."id";

UPDATE "inventory_unit_media" media
SET "is_primary" = true
WHERE media."status" = 'active' AND media."id" = (
  SELECT candidate."id" FROM "inventory_unit_media" candidate
  WHERE candidate."organization_id" = media."organization_id"
    AND candidate."inventory_unit_id" = media."inventory_unit_id"
    AND candidate."status" = 'active'
  ORDER BY candidate."sort_order", candidate."id" LIMIT 1
);

ALTER TABLE "inventory_unit_media" ADD CONSTRAINT "inventory_unit_media_source_type" CHECK ("source_type" in ('actual','cgi-reference','oem-reference'));
ALTER TABLE "inventory_unit_media" ADD CONSTRAINT "inventory_unit_media_media_type" CHECK ("media_type" = 'image');
ALTER TABLE "inventory_unit_media" ADD CONSTRAINT "inventory_unit_media_original_filename" CHECK ("original_filename" is null or length(trim("original_filename")) between 1 and 255);
CREATE UNIQUE INDEX "inventory_unit_media_one_primary_active" ON "inventory_unit_media"("organization_id","inventory_unit_id") WHERE "status"='active' AND "is_primary"=true;

CREATE OR REPLACE FUNCTION prevent_inventory_media_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.organization_id<>OLD.organization_id OR NEW.location_id<>OLD.location_id OR NEW.vehicle_id<>OLD.vehicle_id OR NEW.inventory_unit_id<>OLD.inventory_unit_id OR NEW.provider<>OLD.provider OR NEW.provider_asset_id<>OLD.provider_asset_id OR NEW.delivery_url<>OLD.delivery_url OR NEW.content_type<>OLD.content_type OR NEW.byte_size<>OLD.byte_size OR NEW.sha256<>OLD.sha256 OR NEW.width<>OLD.width OR NEW.height<>OLD.height OR NEW.source_type<>OLD.source_type OR NEW.media_type<>OLD.media_type OR NEW.original_filename IS DISTINCT FROM OLD.original_filename OR NEW.verified_at<>OLD.verified_at OR NEW.verified_by<>OLD.verified_by THEN
    RAISE EXCEPTION 'inventory media authority is immutable';
  END IF;
  IF OLD.status='removed' THEN RAISE EXCEPTION 'removed inventory media is immutable'; END IF;
  RETURN NEW;
END $$;
