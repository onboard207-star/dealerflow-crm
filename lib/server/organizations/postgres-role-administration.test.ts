import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { PostgresRoleAdministration } from "./postgres-role-administration";

function pool(results: unknown[]) {
  const query = vi.fn<DatabaseClient["query"]>();
  for (const result of results) query.mockResolvedValueOnce(result);
  query.mockResolvedValue({});
  const client: DatabaseClient = { query, release: vi.fn() };
  return { pool: { connect: vi.fn().mockResolvedValue(client) } as DatabasePool, query };
}

describe("PostgresRoleAdministration", () => {
  it("rejects provider-level capability escalation before inserting a role", async () => {
    const db = pool([{}, {}, { rows: [{ allowed: false }] }, {}]);
    const result = await new PostgresRoleAdministration(db.pool as unknown as Pool).create({
      actorId: "usr_admin001",
      organizationId: "org_dealerflow",
      role: {
        id: "rol_custom001",
        organizationId: "org_dealerflow",
        key: "deal-approver",
        name: "Deal Approver",
        system: false,
        capabilities: ["deal.approve"],
        memberCount: 0,
        updatedAt: new Date().toISOString(),
      },
    });

    expect(result).toBe("forbidden");
    expect(db.query.mock.calls.some(call => String(call[0]).includes("INSERT INTO roles"))).toBe(false);
  });

  it("keeps system roles immutable in the provider", async () => {
    const updatedAt = new Date("2026-08-25T12:00:00.000Z");
    const db = pool([
      {},
      {},
      { rows: [{ allowed: true }] },
      { rows: [{ system: true, updated_at: updatedAt, self_role: false, manager: true }] },
      {},
    ]);
    const result = await new PostgresRoleAdministration(db.pool as unknown as Pool).update({
      actorId: "usr_admin001",
      organizationId: "org_dealerflow",
      roleId: "rol_system001",
      expectedUpdatedAt: updatedAt.toISOString(),
      name: "Owner",
      capabilities: ["staff.manage"],
    });

    expect(result).toBe("system");
    expect(db.query.mock.calls.some(call => String(call[0]).startsWith("UPDATE roles"))).toBe(false);
  });
});
