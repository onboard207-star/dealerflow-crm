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

  it("scopes the operational Deal panel to the selected buying-cycle Lead", async () => {
    const createdAt = new Date("2026-08-28T12:00:00.000Z");
    const query = vi.fn<DatabaseClient["query"]>(async (statement, values) => {
      const sql = String(statement);
      if (sql.includes("FROM customers WHERE")) {
        return { rows: [{
          id: "cus_returning", location_id: "loc_main", display_name: "Jordan Lee",
          first_name: "Jordan", last_name: "Lee", email: "jordan@example.com",
          phone: "+12075550184", status: "active", created_at: createdAt,
          updated_at: createdAt,
        }] };
      }
      if (sql.includes("FROM leads l LEFT JOIN")) {
        return { rows: [{
          id: "led_new_cycle", source: "Returning Customer", stage: "new", status: "open",
          created_at: createdAt, assigned_user_name: null,
        }] };
      }
      if (sql.includes("FROM deals")) {
        expect(sql).toContain("lead_id = $3");
        expect(values).toEqual(["org_dealerflow", "cus_returning", "led_new_cycle"]);
      }
      return { rows: [] };
    });
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new CustomerWorkspaceReader(pool).read(
      "usr_salesperson_001", "org_dealerflow", "cus_returning",
      { locationIds: ["loc_main"], communications: true, appointments: true, tasks: true, inventory: true, deals: true },
    );

    expect(result?.lead?.id).toBe("led_new_cycle");
    expect(result?.deal).toBeUndefined();
    expect(query.mock.calls.some(([statement]) => String(statement).includes("lead_id = $3"))).toBe(true);
  });

  it("projects the latest immutable Quote and approval state into the Customer summary", async () => {
    const createdAt = new Date("2026-09-04T12:00:00.000Z");
    const query = vi.fn<DatabaseClient["query"]>(async (statement) => {
      const sql = String(statement);
      if (sql.includes("FROM customers WHERE")) return { rows: [{ id: "cus_1", location_id: "loc_1", display_name: "Jordan Lee", first_name: "Jordan", last_name: "Lee", email: null, phone: null, status: "active", created_at: createdAt, updated_at: createdAt }] };
      if (sql.includes("FROM leads l LEFT JOIN")) return { rows: [{ id: "led_1", source: "Website", stage: "working", status: "working", created_at: createdAt, assigned_user_id: "usr_1", assigned_user_name: "Alex Morgan" }] };
      if (sql.includes("FROM deals")) return { rows: [{ id: "dea_1", deal_number: "DF-1001", status: "working", purchase_type: null, agreed_price_cents: null }] };
      if (sql.includes("FROM deal_quotes quote")) {
        expect(sql).toContain("LEFT JOIN deal_quote_approvals");
        expect(sql).toContain("ORDER BY quote.version DESC");
        return { rows: [{ id: "quo_v2", version: 2, status: "draft", purchase_type: "finance", currency: "USD", total_cents: 4100000, expires_at: null, approval_status: "pending" }] };
      }
      if (sql.includes("FROM audit_logs audit")) expect(sql).toContain("quote.approval_requested");
      return { rows: [] };
    });
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new CustomerWorkspaceReader(pool).read("usr_quote01", "org_quote01", "cus_quote01", {
      locationIds: ["loc_quote01"], communications: true, appointments: true, tasks: true, inventory: true, deals: true,
    });

    expect(result?.quote).toMatchObject({ id: "quo_v2", version: 2, approvalStatus: "pending" });
  });
});
