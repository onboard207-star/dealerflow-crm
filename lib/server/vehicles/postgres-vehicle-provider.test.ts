import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { PostgresVehicleProvider } from "./postgres-vehicle-provider";

describe("PostgresVehicleProvider vehicle-interest context", () => {
  it("requires an active lead and same-location inventory for purchase interests", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({}).mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
    const provider = new PostgresVehicleProvider(pool as unknown as Pool, {
      userId: "usr_salesperson", organizationId: "org_dealerflow",
    });

    const result = await provider.transaction((session) => session.interestContextExists(
      { organizationId: "org_dealerflow", locationId: "loc_main" },
      { customerId: "cus_jordan", leadId: "led_jordan", vehicleId: "veh_crv", role: "primary" },
    ));

    expect(result).toBe(true);
    expect(query.mock.calls[2]?.[0]).toContain("l.status IN ('open','working','qualified')");
    expect(query.mock.calls[2]?.[0]).toContain("i.location_id=$5");
    expect(query.mock.calls[2]?.[1]).toEqual([
      "org_dealerflow", "cus_jordan", "led_jordan", "veh_crv", "loc_main", "primary",
    ]);
  });
});
