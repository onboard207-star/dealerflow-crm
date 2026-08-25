import type { Pool } from "pg";
import type { DueOutboundAttempt, DueOutboundDiscovery } from "@/lib/application/communications";

export class PostgresDueOutboundDiscovery implements DueOutboundDiscovery {
  constructor(private readonly pool: Pool) {}
  async listDue(dueBefore: string, limit: number): Promise<readonly DueOutboundAttempt[]> {
    const result = await this.pool.query<{ organization_id: string; attempt_id: string }>(
      "SELECT organization_id, attempt_id FROM list_due_outbound_attempts($1,$2)", [limit, dueBefore]);
    return result.rows.map((row) => ({ organizationId: row.organization_id, attemptId: row.attempt_id }));
  }
}
