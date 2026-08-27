import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { MembershipDirectoryReader } from "./membership-directory";

describe("MembershipDirectoryReader", () => {
  it("uses the canonical user display-name column", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    await new MembershipDirectoryReader(pool as never).list({
      userId: "usr_owner01",
      organizationId: "org_dealerflow",
    });

    const sql = String(query.mock.calls[2]?.[0]);
    expect(sql).toContain("u.display_name AS name");
    expect(sql).toContain("u.display_name");
    expect(sql).not.toContain("u.name");
  });
});
