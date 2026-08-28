import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PostgresTradeProvider", () => {
  it("turns active inventory and stock collisions into domain conflicts", () => {
    const source = readFileSync(new URL("./postgres-handoff-provider.ts", import.meta.url), "utf8");

    expect(source).toContain('uniqueConstraint(error) === "inventory_units_active_vehicle_unique"');
    expect(source).toContain("already has an active dealership inventory record");
    expect(source).toContain("The acquired stock number is already in use.");
  });
});
