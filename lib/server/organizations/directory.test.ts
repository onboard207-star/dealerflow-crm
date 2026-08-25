import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";

import { OrganizationDirectory } from "./directory";

describe("OrganizationDirectory", () => {
  it("lists only active organizations for the authenticated user", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ id: "org_dealerflow", slug: "dealerflow", name: "DealerFlow Motors", vertical: "automotive" }],
      })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const organizations = await new OrganizationDirectory(pool).listForUser("usr_salesperson_001");

    expect(organizations).toHaveLength(1);
    expect(organizations[0]?.id).toBe("org_dealerflow");
    expect(query.mock.calls[1]).toEqual([
      "SELECT set_config('app.user_id', $1, true)",
      ["usr_salesperson_001"],
    ]);
    expect(query.mock.calls[2]?.[0]).toContain("m.status = 'active'");
  });
});
