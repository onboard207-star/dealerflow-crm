import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { generateEntityId } from "@/lib/core/identifiers";

export class InvitationAcceptanceError extends Error {}

export async function acceptOrganizationInvitation(pool: Pool, userId: string, token: string): Promise<{ organizationId: string }> {
  const organizationId = token.split(".", 1)[0] ?? "";
  if (!/^org_[a-z0-9_-]{6,64}$/.test(organizationId) || token.length > 180) throw new InvitationAcceptanceError("The invitation is invalid or expired.");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true),set_config('app.invitation_token_hash',$3,true)", [userId, organizationId, tokenHash]);
    const result = await client.query<{ invitation_id: string; all_locations: boolean }>(
      `SELECT id AS invitation_id,all_locations FROM organization_invitations WHERE organization_id=$1 AND token_hash=$2 AND status='pending' AND expires_at>now() FOR UPDATE`, [organizationId, tokenHash]);
    const invitation = result.rows[0];
    if (!invitation) throw new InvitationAcceptanceError("The invitation is invalid, expired, or belongs to another account.");
    const membershipId = generateEntityId("mem");
    const membership = await client.query<{ id: string }>(`INSERT INTO organization_memberships(id,organization_id,user_id,status,all_locations) VALUES($1,$2,$3,'active',$4) ON CONFLICT(organization_id,user_id) DO UPDATE SET status='active',all_locations=excluded.all_locations,updated_at=now() RETURNING id`, [membershipId, organizationId, userId, invitation.all_locations]);
    const resolvedMembershipId = membership.rows[0]?.id;
    if (!resolvedMembershipId) throw new InvitationAcceptanceError("The membership could not be activated.");
    await client.query("DELETE FROM membership_roles WHERE organization_id=$1 AND membership_id=$2", [organizationId, resolvedMembershipId]);
    await client.query("INSERT INTO membership_roles(membership_id,organization_id,role_id) SELECT $2,$1,role_id FROM organization_invitation_roles WHERE organization_id=$1 AND invitation_id=$3", [organizationId, resolvedMembershipId, invitation.invitation_id]);
    await client.query("DELETE FROM membership_locations WHERE organization_id=$1 AND membership_id=$2", [organizationId, resolvedMembershipId]);
    if (!invitation.all_locations) await client.query("INSERT INTO membership_locations(membership_id,organization_id,location_id) SELECT $2,$1,location_id FROM organization_invitation_locations WHERE organization_id=$1 AND invitation_id=$3", [organizationId, resolvedMembershipId, invitation.invitation_id]);
    await client.query("UPDATE organization_invitations SET status='accepted',accepted_by=$3,accepted_at=now(),updated_at=now() WHERE organization_id=$1 AND id=$2", [organizationId, invitation.invitation_id, userId]);
    await client.query("COMMIT");
    return { organizationId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
