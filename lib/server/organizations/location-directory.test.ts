import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { LocationDirectoryReader } from "./location-directory";

describe("LocationDirectoryReader", () => {
  it("limits active locations to the membership location grant", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({}).mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: "loc_main", name: "Main Store" }] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new LocationDirectoryReader(pool).listActive({
      userId: "usr_salesperson", organizationId: "org_dealerflow", locationIds: ["loc_main"],
    });

    expect(result).toEqual([{ id: "loc_main", name: "Main Store" }]);
    expect(query.mock.calls[2]?.[0]).toContain("id=ANY($3::text[])");
    expect(query.mock.calls[2]?.[1]).toEqual(["org_dealerflow", false, ["loc_main"]]);
  });
});
