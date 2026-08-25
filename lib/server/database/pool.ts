import { Pool, type PoolConfig } from "pg";

import type { ApplicationEnvironment } from "@/lib/server/config";
import { parseServerEnvironment } from "@/lib/server/config";

export interface DatabasePoolConfiguration {
  connectionString: string;
  appEnvironment: ApplicationEnvironment;
  maximumConnections?: number;
}

export function createDatabasePool(
  configuration: DatabasePoolConfiguration,
): Pool {
  const poolConfiguration: PoolConfig = {
    connectionString: configuration.connectionString,
    max: configuration.maximumConnections ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "dealerflow-ai",
    ssl:
      configuration.appEnvironment === "development" ||
      configuration.appEnvironment === "test"
        ? undefined
        : { rejectUnauthorized: true },
  };

  return new Pool(poolConfiguration);
}

let sharedPool: Pool | undefined;

export function getDatabasePool(): Pool {
  if (sharedPool) return sharedPool;

  const environment = parseServerEnvironment(process.env, { database: true });
  if (!environment.databaseUrl) {
    throw new Error("Database configuration is unavailable.");
  }
  sharedPool = createDatabasePool({
    connectionString: environment.databaseUrl,
    appEnvironment: environment.appEnvironment,
  });
  return sharedPool;
}
