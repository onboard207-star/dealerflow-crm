import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { CRMDirectoryQueryError, CRMDirectoryReader } from "./directory-reader";

const now = new Date("2026-08-23T12:00:00.000Z");
function databaseWithRows(rows: Array<Record<string, unknown>>) {
  const query = vi.fn<DatabaseClient["query"]>()
    .mockResolvedValueOnce({}).mockResolvedValueOnce({})
    .mockResolvedValueOnce({ rows }).mockResolvedValueOnce({});
  const client: DatabaseClient = { query, release: vi.fn() };
  const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
  return { pool, query };
}

describe("CRMDirectoryReader", () => {
  it("filters customer search by allowed locations and returns an opaque cursor", async () => {
    const rows = ["cus_one", "cus_two"].map((id) => ({ id, display_name: id, email: null,
      phone: null, status: "active", location_name: "Main", lead_id: null,
      lead_stage: null, lead_status: null, created_at: now }));
    const { pool, query } = databaseWithRows(rows);
    const result = await new CRMDirectoryReader(pool).listCustomers({
      userId: "usr_salesperson_001", organizationId: "org_dealerflow",
      locationIds: ["loc_main"],
    }, { search: " Jordan ", limit: 1 });
    expect(result.records).toHaveLength(1); expect(result.nextCursor).toBeTruthy();
    expect(query.mock.calls[2]?.[1]).toEqual([
      "org_dealerflow", false, ["loc_main"], "jordan", null, null, null, 2,
    ]);
  });

  it("keeps location restrictions on the lead queue customer join", async () => {
    const { pool, query } = databaseWithRows([]);
    await new CRMDirectoryReader(pool).listLeads({
      userId: "usr_salesperson_001", organizationId: "org_dealerflow",
      locationIds: ["loc_main"],
    }, { status: "working" });
    const leadSql = String(query.mock.calls[2]?.[0]);
    expect(leadSql).toContain("c.location_id = ANY($3::text[])");
    expect(leadSql).toContain("l.status::text = $6");
    expect(leadSql).not.toContain("l.status = $6");
    expect(query.mock.calls[2]?.[1]).toContain("working");
  });

  it("rejects oversized searches and invalid page limits before connecting", async () => {
    const { pool } = databaseWithRows([]);
    const reader = new CRMDirectoryReader(pool);
    expect(() => reader.listCustomers({ userId: "usr_salesperson_001", organizationId: "org_dealerflow", locationIds: "all" }, { search: "x".repeat(101) }))
      .toThrow(CRMDirectoryQueryError);
    expect(() => reader.listCustomers({ userId: "usr_salesperson_001", organizationId: "org_dealerflow", locationIds: "all" }, { limit: 101 }))
      .toThrow(CRMDirectoryQueryError);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
