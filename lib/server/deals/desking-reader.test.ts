import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { DealDeskingReader } from "./desking-reader";

describe("DealDeskingReader", () => {
  it("keeps aggregate deal metrics inside tenant and membership location scope", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [
        { status: "working", count: "3", aged_count: "1" },
        { status: "pending-approval", count: "2", aged_count: "1" },
        { status: "approved", count: "1", aged_count: "0" },
      ] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
    const result = await new DealDeskingReader(pool).read({ userId: "usr_finance", organizationId: "org_demo01", locationIds: ["loc_main"] });
    expect(query.mock.calls[2]?.[0]).toContain("d.organization_id = $1");
    expect(query.mock.calls[2]?.[0]).toContain("d.location_id = ANY($3::text[])");
    expect(query.mock.calls[2]?.[1]).toEqual(["org_demo01", false, ["loc_main"]]);
    expect(result).toMatchObject({ active: 6, aged: 2, needsApproval: 2, readyForFinance: 1 });
  });
});
