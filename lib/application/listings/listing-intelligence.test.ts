import { describe, expect, it } from "vitest";
import { planListingRemovalAlert, type VehicleListing } from "./listing-intelligence";

const listing = (overrides: Partial<VehicleListing> = {}): VehicleListing => ({
  id: "lst_1",
  inventoryUnitId: "inv_1",
  channel: "Dealer Website",
  status: "Active",
  managementMode: "Manual",
  responsibleSalesperson: "Alex",
  ...overrides,
});

describe("planListingRemovalAlert", () => {
  it("returns no alert when the unit has no active listings", () => {
    expect(planListingRemovalAlert("inv_1", [listing({ status: "Removed" })])).toBeNull();
  });

  it("summarizes channels and creates accountable manual removal tasks", () => {
    const result = planListingRemovalAlert("inv_1", [
      listing(),
      listing({ id: "lst_2", channel: "AutoTrader", managementMode: "Authorized Integration" }),
      listing({ id: "lst_3", channel: "Facebook Marketplace", responsibleSalesperson: undefined }),
    ]);

    expect(result?.activeListingCount).toBe(3);
    expect(result?.channels).toEqual(["Dealer Website", "AutoTrader", "Facebook Marketplace"]);
    expect(result?.integrationListings).toHaveLength(1);
    expect(result?.removalTasks.map((task) => task.idempotencyKey)).toEqual([
      "listing-removal:inv_1:lst_1",
      "listing-removal:inv_1:lst_3",
    ]);
    expect(result?.message).toContain("active listings on 3 channels");
  });

  it("does not include listings for another inventory unit", () => {
    expect(planListingRemovalAlert("inv_1", [listing({ inventoryUnitId: "inv_2" })])).toBeNull();
  });
});
