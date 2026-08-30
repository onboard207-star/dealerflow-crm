import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface DealDeskingSummary {
  active: number;
  aged: number;
  byStatus: readonly { count: number; status: string }[];
  needsApproval: number;
  readyForFinance: number;
}

export class DealDeskingReader {
  constructor(private readonly pool: DatabasePool) {}

  read(context: { userId: string; organizationId: string; locationIds: readonly string[] | "all" }): Promise<DealDeskingSummary> {
    return withTenantDatabaseContext(this.pool, context, async (client) => {
      const allLocations = context.locationIds === "all";
      const locationIds = allLocations ? [] : [...context.locationIds];
      const result = (await client.query(`SELECT d.status::text AS status, COUNT(*)::text AS count,
        COUNT(*) FILTER (WHERE d.updated_at < NOW() - INTERVAL '7 days')::text AS aged_count
        FROM deals d
        WHERE d.organization_id = $1 AND ($2::boolean OR d.location_id = ANY($3::text[]))
          AND d.status NOT IN ('delivered', 'cancelled')
        GROUP BY d.status ORDER BY d.status`, [context.organizationId, allLocations, locationIds])) as { rows: Array<{ status: string; count: string; aged_count: string }> };
      const byStatus = result.rows.map((row) => ({ count: Number(row.count), status: row.status }));
      const count = (statuses: readonly string[]) => byStatus.filter((item) => statuses.includes(item.status)).reduce((total, item) => total + item.count, 0);
      return {
        active: count(["draft", "working", "pending-approval", "approved", "contracted"]),
        aged: result.rows.reduce((total, row) => total + Number(row.aged_count), 0),
        byStatus,
        needsApproval: count(["pending-approval"]),
        readyForFinance: count(["approved", "contracted"]),
      };
    });
  }
}
