ALTER TABLE "deals" ADD COLUMN "appointment_id" text;
ALTER TABLE "deals" ADD COLUMN "showroom_visit_id" text;

CREATE UNIQUE INDEX "appointments_deal_journey_unique"
  ON "appointments" ("organization_id", "location_id", "customer_id", "lead_id", "id");
CREATE UNIQUE INDEX "showroom_visits_deal_journey_unique"
  ON "showroom_visits" ("organization_id", "location_id", "customer_id", "lead_id", "appointment_id", "id");

ALTER TABLE "deals" ADD CONSTRAINT "deals_same_journey_appointment_fk"
  FOREIGN KEY ("organization_id", "location_id", "customer_id", "lead_id", "appointment_id")
  REFERENCES "appointments" ("organization_id", "location_id", "customer_id", "lead_id", "id");
ALTER TABLE "deals" ADD CONSTRAINT "deals_same_journey_visit_fk"
  FOREIGN KEY ("organization_id", "location_id", "customer_id", "lead_id", "appointment_id", "showroom_visit_id")
  REFERENCES "showroom_visits" ("organization_id", "location_id", "customer_id", "lead_id", "appointment_id", "id");
ALTER TABLE "deals" ADD CONSTRAINT "deals_visit_requires_appointment"
  CHECK ("showroom_visit_id" IS NULL OR "appointment_id" IS NOT NULL);

CREATE INDEX "deals_appointment_idx" ON "deals" ("organization_id", "appointment_id")
  WHERE "appointment_id" IS NOT NULL;
CREATE INDEX "deals_showroom_visit_idx" ON "deals" ("organization_id", "showroom_visit_id")
  WHERE "showroom_visit_id" IS NOT NULL;

CREATE FUNCTION prevent_deal_journey_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id<>OLD.organization_id
    OR NEW.location_id<>OLD.location_id
    OR NEW.customer_id<>OLD.customer_id
    OR NEW.lead_id<>OLD.lead_id
    OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
    OR NEW.showroom_visit_id IS DISTINCT FROM OLD.showroom_visit_id
    OR NEW.primary_vehicle_id<>OLD.primary_vehicle_id
    OR NEW.inventory_unit_id IS DISTINCT FROM OLD.inventory_unit_id
    OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.idempotency_key<>OLD.idempotency_key
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at<>OLD.created_at
  THEN RAISE EXCEPTION 'deal journey authority fields are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "deals_journey_immutable" BEFORE UPDATE ON "deals"
  FOR EACH ROW EXECUTE FUNCTION prevent_deal_journey_rewrite();
