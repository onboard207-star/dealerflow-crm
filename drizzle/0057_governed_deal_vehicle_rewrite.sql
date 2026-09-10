CREATE OR REPLACE FUNCTION prevent_deal_journey_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id<>OLD.organization_id
    OR NEW.location_id<>OLD.location_id
    OR NEW.customer_id<>OLD.customer_id
    OR NEW.lead_id<>OLD.lead_id
    OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
    OR NEW.showroom_visit_id IS DISTINCT FROM OLD.showroom_visit_id
    OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.idempotency_key<>OLD.idempotency_key
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at<>OLD.created_at
  THEN RAISE EXCEPTION 'deal journey authority fields are immutable';
  END IF;

  IF NEW.primary_vehicle_id<>OLD.primary_vehicle_id
    OR NEW.inventory_unit_id IS DISTINCT FROM OLD.inventory_unit_id
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM deal_vehicle_change_events event
      WHERE event.organization_id=OLD.organization_id
        AND event.deal_id=OLD.id
        AND event.from_vehicle_id=OLD.primary_vehicle_id
        AND event.from_inventory_unit_id IS NOT DISTINCT FROM OLD.inventory_unit_id
        AND event.to_vehicle_id=NEW.primary_vehicle_id
        AND event.to_inventory_unit_id IS NOT DISTINCT FROM NEW.inventory_unit_id
    ) THEN
      RAISE EXCEPTION 'deal journey authority fields are immutable';
    END IF;
  END IF;

  RETURN NEW;
END $$;
