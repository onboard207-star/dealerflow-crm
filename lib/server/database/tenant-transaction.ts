export interface TenantDatabaseContext {
  userId: string;
  organizationId: string;
}

export interface DatabaseClient {
  query(queryText: string, values?: readonly unknown[]): Promise<unknown>;
  release(): void;
}

export interface DatabasePool {
  connect(): Promise<DatabaseClient>;
}

export class TenantDatabaseContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantDatabaseContextError";
  }
}

export async function withTenantDatabaseContext<Result>(
  pool: DatabasePool,
  context: TenantDatabaseContext,
  operation: (client: DatabaseClient) => Promise<Result>,
): Promise<Result> {
  assertDatabaseContext(context);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.user_id', $1, true), set_config('app.organization_id', $2, true)",
      [context.userId, context.organizationId],
    );
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function withUserDatabaseContext<Result>(
  pool: DatabasePool,
  userId: string,
  operation: (client: DatabaseClient) => Promise<Result>,
): Promise<Result> {
  assertUserId(userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  } finally {
    client.release();
  }
}

function assertDatabaseContext(context: TenantDatabaseContext): void {
  assertUserId(context.userId);

  if (!/^org_[a-z0-9_-]{6,64}$/.test(context.organizationId)) {
    throw new TenantDatabaseContextError("A valid organization ID is required.");
  }
}

function assertUserId(userId: string): void {
  if (!/^usr_[a-z0-9_-]{6,64}$/.test(userId)) {
    throw new TenantDatabaseContextError("A valid authenticated user ID is required.");
  }
}

async function rollbackQuietly(client: DatabaseClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original operation failure. The pool will discard a broken client.
  }
}
