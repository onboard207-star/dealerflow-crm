import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { CustomerWorkspaceReader } from "./workspace-reader";

describe("CustomerWorkspaceReader", () => {
  it("applies allowed locations to the customer lookup before reading related data", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new CustomerWorkspaceReader(pool).read(
      "usr_salesperson_001", "org_dealerflow", "cus_restricted",
      { locationIds: ["loc_allowed"], communications: true, appointments: true, tasks: true, inventory: true, deals: true },
    );

    expect(result).toBeNull();
    expect(query.mock.calls[2]?.[0]).toContain("location_id = ANY($4::text[])");
    expect(query.mock.calls[2]?.[1]).toEqual([
      "org_dealerflow", "cus_restricted", false, ["loc_allowed"],
    ]);
    expect(query).toHaveBeenCalledTimes(4);
  });
});
