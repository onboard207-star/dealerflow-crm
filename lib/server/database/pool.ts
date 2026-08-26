import { Pool, type PoolConfig } from "pg";

import type {
  ApplicationEnvironment,
  DatabaseSslMode,
} from "@/lib/server/config";
import { parseServerEnvironment } from "@/lib/server/config";

export interface DatabasePoolConfiguration {
  connectionString: string;
  appEnvironment: ApplicationEnvironment;
  sslMode?: DatabaseSslMode;
  runtime?: "application" | "authentication";
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
    options:
      configuration.runtime === "authentication"
        ? "-c app.auth_runtime=enabled"
        : undefined,
    ssl: resolveDatabaseSsl(configuration),
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
    sslMode: environment.databaseSslMode,
  });
  return sharedPool;
}

function resolveDatabaseSsl(
  configuration: DatabasePoolConfiguration,
): PoolConfig["ssl"] {
  if (configuration.sslMode === "disable") return undefined;
  if (configuration.sslMode === "verify-full") {
    return { rejectUnauthorized: true };
  }

  return configuration.appEnvironment === "development" ||
    configuration.appEnvironment === "test"
    ? undefined
    : { rejectUnauthorized: true };
}
