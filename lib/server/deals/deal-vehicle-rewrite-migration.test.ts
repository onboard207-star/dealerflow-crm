import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("0057 governed Deal vehicle rewrite", () => {
  const migration = readFileSync(
    new URL("../../../drizzle/0057_governed_deal_vehicle_rewrite.sql", import.meta.url),
    "utf8",
  );

  it("keeps every non-vehicle Deal journey authority field immutable", () => {
    for (const field of [
      "organization_id",
      "location_id",
      "customer_id",
      "lead_id",
      "appointment_id",
      "showroom_visit_id",
      "owner_user_id",
      "idempotency_key",
      "created_by",
      "created_at",
    ]) {
      expect(migration).toContain(`NEW.${field}`);
    }
  });

  it("permits a vehicle rewrite only when an exact immutable lifecycle event already exists", () => {
    expect(migration).toContain("FROM deal_vehicle_change_events event");
    expect(migration).toContain("event.from_vehicle_id=OLD.primary_vehicle_id");
    expect(migration).toContain("event.from_inventory_unit_id IS NOT DISTINCT FROM OLD.inventory_unit_id");
    expect(migration).toContain("event.to_vehicle_id=NEW.primary_vehicle_id");
    expect(migration).toContain("event.to_inventory_unit_id IS NOT DISTINCT FROM NEW.inventory_unit_id");
  });
});
