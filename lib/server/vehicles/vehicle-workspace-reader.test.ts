import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { VehicleWorkspaceReader } from "./vehicle-workspace-reader";

const inventoryRow = {
  id: "inv_vehicle01",
  vehicle_id: "veh_vehicle01",
  location_id: "loc_main01",
  location_name: "DealerFlow Main",
  stock_number: "DF24001",
  status: "available",
  list_price_cents: 4299500,
  acquired_at: new Date("2026-08-01T12:00:00.000Z"),
  sold_at: null,
  updated_at: new Date("2026-08-26T12:00:00.000Z"),
  vin: "1HGBH41JXMN109186",
  year: 2026,
  make: "Honda",
  model: "CR-V",
  trim: "Hybrid Touring",
  exterior_color: "Platinum White Pearl",
};

describe("VehicleWorkspaceReader", () => {
  it("returns authoritative inventory context and location-scoped relationships", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [inventoryRow] })
      .mockResolvedValueOnce({
        rows: [{
          id: "ima_vehicle01",
          delivery_url: "https://media.dealerflow.example/inventory/DF24001/front.webp",
          content_type: "image/webp",
          width: 1600,
          height: 1200,
          alt_text: "Front three-quarter view of the 2026 Honda CR-V",
          sort_order: 0,
          captured_at: new Date("2026-08-02T12:00:00.000Z"),
          verified_at: new Date("2026-08-02T12:05:00.000Z"),
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "iue_event01",
          kind: "created",
          from_status: null,
          to_status: "available",
          old_price_cents: null,
          new_price_cents: 4299500,
          reason: "New inventory",
          occurred_at: new Date("2026-08-01T12:00:00.000Z"),
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          interest_id: "vhi_interest01",
          customer_id: "cus_customer01",
          customer_name: "Jordan Lee",
          lead_id: "led_buycycle01",
          lead_status: "working",
          lead_stage: "vehicle_selected",
          assigned_user_name: "Alex Morgan",
          role: "primary",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "dea_deal0001",
          customer_id: "cus_customer01",
          customer_name: "Jordan Lee",
          deal_number: "D-260042",
          status: "draft",
          agreed_price_cents: 4200000,
        }],
      })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new VehicleWorkspaceReader(pool).read({
      userId: "usr_salesperson01",
      organizationId: "org_dealerflow",
      locationIds: ["loc_main01"],
      includeCustomerMatches: true,
      includeDeals: true,
    }, "inv_vehicle01");

    expect(result?.vehicle).toEqual({
      vin: inventoryRow.vin,
      year: 2026,
      make: "Honda",
      model: "CR-V",
      trim: "Hybrid Touring",
      exteriorColor: "Platinum White Pearl",
    });
    expect(result?.matches[0]).toMatchObject({ customerName: "Jordan Lee", role: "primary" });
    expect(result?.media[0]).toMatchObject({ id: "ima_vehicle01", contentType: "image/webp", sortOrder: 0 });
    expect(result?.deals[0]).toMatchObject({ dealNumber: "D-260042", agreedPriceCents: 4200000 });
    expect(query.mock.calls[2]?.[0]).toContain("i.location_id=ANY($4::text[])");
    expect(query.mock.calls[2]?.[1]).toEqual(["org_dealerflow", "inv_vehicle01", false, ["loc_main01"]]);
    expect(query.mock.calls[3]?.[0]).toContain("location_id=$3 AND vehicle_id=$4");
    expect(query.mock.calls[3]?.[1]).toEqual(["org_dealerflow", "inv_vehicle01", "loc_main01", "veh_vehicle01"]);
    expect(query.mock.calls[5]?.[0]).toContain("lead.location_id=ANY($4::text[])");
    expect(query.mock.calls[5]?.[1]).toEqual(["org_dealerflow", "veh_vehicle01", false, ["loc_main01"]]);
    expect(query.mock.calls[6]?.[0]).toContain("deal.location_id=ANY($4::text[])");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("returns null before relationship queries when the unit is outside the location grant", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new VehicleWorkspaceReader(pool).read({
      userId: "usr_salesperson01",
      organizationId: "org_dealerflow",
      locationIds: ["loc_allowed01"],
      includeCustomerMatches: true,
      includeDeals: true,
    }, "inv_restricted01");

    expect(result).toBeNull();
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("does not query customer or deal data without the corresponding capabilities", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [inventoryRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new VehicleWorkspaceReader(pool).read({
      userId: "usr_inventory01",
      organizationId: "org_dealerflow",
      locationIds: "all",
      includeCustomerMatches: false,
      includeDeals: false,
    }, "inv_vehicle01");

    expect(result?.matches).toEqual([]);
    expect(result?.deals).toEqual([]);
    expect(query).toHaveBeenCalledTimes(6);
  });
});
