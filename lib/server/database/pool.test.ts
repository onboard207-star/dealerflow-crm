import { describe, expect, it } from "vitest";

import { createDatabasePool } from "./pool";

describe("createDatabasePool", () => {
  it("keeps certificate verification as the production default", async () => {
    const pool = createDatabasePool({
      connectionString: "postgresql://user:password@db.example.com/dealerflow",
      appEnvironment: "production",
    });

    expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });
    await pool.end();
  });

  it("allows SSL to be disabled explicitly for a private database network", async () => {
    const pool = createDatabasePool({
      connectionString: "postgresql://user:password@private-db/dealerflow",
      appEnvironment: "staging",
      sslMode: "disable",
    });

    expect(pool.options.ssl).toBeUndefined();
    await pool.end();
  });

  it("scopes authentication connections with an explicit PostgreSQL setting", async () => {
    const pool = createDatabasePool({
      connectionString: "postgresql://user:password@private-db/dealerflow",
      appEnvironment: "staging",
      runtime: "authentication",
    });

    expect(pool.options.options).toBe("-c app.auth_runtime=enabled");
    await pool.end();
  });
});
