import { withUserDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface OrganizationSummary {
  id: string;
  slug: string;
  name: string;
  vertical: string;
}

export class OrganizationDirectory {
  constructor(private readonly pool: DatabasePool) {}

  listForUser(userId: string): Promise<readonly OrganizationSummary[]> {
    return withUserDatabaseContext(this.pool, userId, async (client) => {
      const result = (await client.query(
        `SELECT o.id, o.slug, o.name, o.vertical
         FROM organizations o
         JOIN organization_memberships m ON m.organization_id = o.id
         WHERE m.user_id = $1 AND m.status = 'active' AND o.active = true
         ORDER BY o.name, o.id`,
        [userId],
      )) as { rows: OrganizationSummary[] };
      return result.rows;
    });
  }
}
