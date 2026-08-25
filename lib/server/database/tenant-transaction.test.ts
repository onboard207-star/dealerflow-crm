import { describe, expect, it, vi } from "vitest";

import {
  TenantDatabaseContextError,
  withTenantDatabaseContext,
  withUserDatabaseContext,
  type DatabaseClient,
  type DatabasePool,
} from "./tenant-transaction";

function createDatabaseDouble() {
  const query = vi.fn<DatabaseClient["query"]>().mockResolvedValue({});
  const release = vi.fn();
  const client: DatabaseClient = { query, release };
  const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

  return { client, pool, query, release };
}

describe("withTenantDatabaseContext", () => {
  it("sets transaction-local user and tenant context before executing work", async () => {
    const { client, pool, query, release } = createDatabaseDouble();

    const result = await withTenantDatabaseContext(
      pool,
      {
        userId: "usr_salesperson_001",
        organizationId: "org_dealerflow_demo",
      },
      async (transaction) => {
        expect(transaction).toBe(client);
        await transaction.query("SELECT * FROM leads");
        return "complete";
      },
    );

    expect(result).toBe("complete");
    expect(query.mock.calls).toEqual([
      ["BEGIN"],
      [
        "SELECT set_config('app.user_id', $1, true), set_config('app.organization_id', $2, true)",
        ["usr_salesperson_001", "org_dealerflow_demo"],
      ],
      ["SELECT * FROM leads"],
      ["COMMIT"],
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the client when work fails", async () => {
    const { pool, query, release } = createDatabaseDouble();
    const failure = new Error("operation failed");

    await expect(
      withTenantDatabaseContext(
        pool,
        {
          userId: "usr_salesperson_001",
          organizationId: "org_dealerflow_demo",
        },
        async () => {
          throw failure;
        },
      ),
    ).rejects.toBe(failure);

    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects untrusted context before acquiring a connection", async () => {
    const { pool } = createDatabaseDouble();

    await expect(
      withTenantDatabaseContext(
        pool,
        { userId: "anonymous", organizationId: "org_dealerflow_demo" },
        async () => undefined,
      ),
    ).rejects.toBeInstanceOf(TenantDatabaseContextError);

    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe("withUserDatabaseContext", () => {
  it("sets only authenticated user context for organization discovery", async () => {
    const { pool, query } = createDatabaseDouble();
    await withUserDatabaseContext(pool, "usr_salesperson_001", async (client) => {
      await client.query("SELECT * FROM organizations");
    });
    expect(query.mock.calls).toEqual([
      ["BEGIN"],
      ["SELECT set_config('app.user_id', $1, true)", ["usr_salesperson_001"]],
      ["SELECT * FROM organizations"],
      ["COMMIT"],
    ]);
  });

  it("rejects invalid users before connecting", async () => {
    const { pool } = createDatabaseDouble();
    await expect(
      withUserDatabaseContext(pool, "anonymous", async () => undefined),
    ).rejects.toBeInstanceOf(TenantDatabaseContextError);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
