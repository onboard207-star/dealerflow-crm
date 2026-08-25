import type { Pool } from "pg";
import { withTenantDatabaseContext } from "@/lib/server/database";

export interface InvitationDirectoryRecord { id: string; email: string; status: "pending"|"accepted"|"revoked"|"expired"; allLocations: boolean; roles: readonly string[]; locations: readonly string[]; expiresAt: string; createdAt: string; resendCount: number; deliveryStatus?: "queued"|"sending"|"sent"|"failed"; deliveryAttempts?: number; deliveryErrorCode?: string }
export interface InvitationOption { id: string; name: string }
export interface InvitationDirectoryResult { invitations: readonly InvitationDirectoryRecord[]; roles: readonly InvitationOption[]; locations: readonly InvitationOption[] }

export class InvitationDirectoryReader {
  constructor(private readonly pool: Pool) {}
  async list(scope: { userId: string; organizationId: string }): Promise<InvitationDirectoryResult> {
    return withTenantDatabaseContext(this.pool, scope, async (client) => {
      await client.query("UPDATE organization_invitations SET status='expired',updated_at=now() WHERE organization_id=$1 AND status='pending' AND expires_at<=now()", [scope.organizationId]);
      const [invitations, roles, locations] = await Promise.all([
        client.query(`SELECT i.id,i.email,i.status::text status,i.all_locations,i.expires_at,i.created_at,i.resend_count,delivery.status::text delivery_status,delivery.attempt_count delivery_attempts,delivery.last_error_code delivery_error_code,COALESCE(array_agg(DISTINCT r.name) FILTER(WHERE r.id IS NOT NULL),'{}') roles,COALESCE(array_agg(DISTINCT l.name) FILTER(WHERE l.id IS NOT NULL),'{}') locations FROM organization_invitations i LEFT JOIN LATERAL(SELECT status,attempt_count,last_error_code FROM transactional_email_messages WHERE organization_id=i.organization_id AND invitation_id=i.id ORDER BY created_at DESC LIMIT 1) delivery ON true LEFT JOIN organization_invitation_roles ir ON ir.invitation_id=i.id AND ir.organization_id=i.organization_id LEFT JOIN roles r ON r.id=ir.role_id AND r.organization_id=i.organization_id LEFT JOIN organization_invitation_locations il ON il.invitation_id=i.id AND il.organization_id=i.organization_id LEFT JOIN locations l ON l.id=il.location_id AND l.organization_id=i.organization_id WHERE i.organization_id=$1 GROUP BY i.id,delivery.status,delivery.attempt_count,delivery.last_error_code ORDER BY i.created_at DESC LIMIT 100`, [scope.organizationId]),
        client.query("SELECT id,name FROM roles WHERE organization_id=$1 ORDER BY name", [scope.organizationId]),
        client.query("SELECT id,name FROM locations WHERE organization_id=$1 AND active=true ORDER BY name", [scope.organizationId]),
      ]) as [{ rows: Array<{ id:string; email:string; status:InvitationDirectoryRecord["status"]; all_locations:boolean; roles:string[]; locations:string[]; expires_at:Date; created_at:Date; resend_count:number; delivery_status?:InvitationDirectoryRecord["deliveryStatus"];delivery_attempts?:number;delivery_error_code?:string }> }, { rows: InvitationOption[] }, { rows: InvitationOption[] }];
      return { invitations: invitations.rows.map((row) => ({ id:row.id,email:row.email,status:row.status,allLocations:row.all_locations,roles:row.roles,locations:row.locations,expiresAt:row.expires_at.toISOString(),createdAt:row.created_at.toISOString(),resendCount:row.resend_count,...(row.delivery_status?{deliveryStatus:row.delivery_status}:{}),...(row.delivery_attempts!==undefined?{deliveryAttempts:row.delivery_attempts}:{}),...(row.delivery_error_code?{deliveryErrorCode:row.delivery_error_code}:{}) })), roles: roles.rows, locations: locations.rows };
    });
  }
}
