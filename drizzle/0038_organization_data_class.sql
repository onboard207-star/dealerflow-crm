ALTER TABLE "organizations" ADD COLUMN "data_class" text DEFAULT 'production' NOT NULL;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_data_class" CHECK ("data_class" in ('demo','pilot','production'));

CREATE FUNCTION enforce_product_event_data_class() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text;
BEGIN
  SELECT "data_class" INTO expected FROM "organizations" WHERE "id"=NEW."organization_id";
  IF expected IS NULL OR NEW."data_class"<>expected THEN RAISE EXCEPTION 'Product event data class must match organization authority'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "product_usage_events_data_class_authority" BEFORE INSERT ON "product_usage_events" FOR EACH ROW EXECUTE FUNCTION enforce_product_event_data_class();
