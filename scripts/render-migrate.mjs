import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run database migrations.");
}

const sslMode = process.env.DATABASE_SSL_MODE ?? "verify-full";
const pool = new pg.Pool({
  connectionString,
  ssl: sslMode === "disable" ? false : { rejectUnauthorized: true },
  max: 1,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.info("DealerFlow database migrations completed.");
} finally {
  await pool.end();
}
