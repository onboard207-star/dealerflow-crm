import type { Pool } from "pg";
import type { InvitationDraft, InvitationProvider, InvitationEmailSender, InvitationOperationsProvider } from "@/lib/application/organizations";
import { generateEntityId } from "@/lib/core/identifiers";
import { withTenantDatabaseContext } from "@/lib/server/database";
import { PostgresTransactionalEmailQueue, createOrganizationInvitationEmail } from "@/lib/server/email";

export class PostgresInvitationProvider implements InvitationProvider, InvitationOperationsProvider {
  constructor(private readonly pool: Pool, private readonly applicationUrl: string) {}
  async create(draft: InvitationDraft): Promise<{ invitationId: string; organizationName: string; created: boolean; emailQueued: boolean }> {
    return withTenantDatabaseContext(this.pool, { userId: draft.invitedBy, organizationId: draft.organizationId }, async (client) => {
      const invitationId = generateEntityId("oin");
      const result = await client.query(
        `WITH valid_roles AS (SELECT id FROM roles WHERE organization_id=$1 AND id=ANY($8::text[])), valid_locations AS (SELECT id FROM locations WHERE organization_id=$1 AND active=true AND id=ANY($9::text[])), inserted AS (INSERT INTO organization_invitations (id,organization_id,email,token_hash,idempotency_key,all_locations,expires_at,invited_by) SELECT $2,$1,$3,$4,$5,$6,$7,$10 WHERE (SELECT count(*) FROM valid_roles)=cardinality($8::text[]) AND ($6 OR (SELECT count(*) FROM valid_locations)=cardinality($9::text[])) AND (SELECT count(*) FROM organization_invitations WHERE organization_id=$1 AND invited_by=$10 AND created_at>now()-interval '1 hour')<20 ON CONFLICT (organization_id,idempotency_key) DO UPDATE SET updated_at=organization_invitations.updated_at RETURNING id,(xmax=0) AS created), inserted_roles AS (INSERT INTO organization_invitation_roles(invitation_id,organization_id,role_id) SELECT inserted.id,$1,valid_roles.id FROM inserted CROSS JOIN valid_roles WHERE inserted.created ON CONFLICT DO NOTHING), inserted_locations AS (INSERT INTO organization_invitation_locations(invitation_id,organization_id,location_id) SELECT inserted.id,$1,valid_locations.id FROM inserted CROSS JOIN valid_locations WHERE inserted.created ON CONFLICT DO NOTHING) SELECT inserted.id, inserted.created, o.name FROM inserted JOIN organizations o ON o.id=$1`,
        [draft.organizationId, invitationId, draft.email, draft.tokenHash, draft.idempotencyKey, draft.allLocations, draft.expiresAt, draft.roleIds, draft.locationIds, draft.invitedBy],
      ) as { rows: Array<{ id: string; name: string; created: boolean }> };
      const row = result.rows[0];
      if (!row) throw new Error("Invitation roles or locations are invalid.");
      if (row.created) {
        const url = new URL("/accept-invitation", this.applicationUrl);
        url.searchParams.set("token", draft.deliveryToken);
        const message = createOrganizationInvitationEmail({ recipientEmail: draft.email, organizationName: row.name, actionUrl: url.toString(), idempotencyKey: `organization-invitation:${row.id}` });
        await client.query(`INSERT INTO transactional_email_messages(id,organization_id,invitation_id,kind,recipient_email,subject,text_body,html_body,idempotency_key) VALUES($1,$2,$3,$4,lower($5),$6,$7,$8,$9) ON CONFLICT(idempotency_key) DO NOTHING`, [generateEntityId("tem"), draft.organizationId, row.id, message.kind, message.recipientEmail, message.subject, message.textBody, message.htmlBody, message.idempotencyKey]);
      }
      return { invitationId: row.id, organizationName: row.name, created: row.created, emailQueued: row.created };
    });
  }

  async revoke(input: { organizationId: string; invitationId: string; actorId: string }): Promise<boolean> {
    return withTenantDatabaseContext(this.pool, { userId: input.actorId, organizationId: input.organizationId }, async (client) => {
      const result = await client.query("UPDATE organization_invitations SET status='revoked',revoked_at=now(),revoked_by=$3,updated_at=now() WHERE organization_id=$1 AND id=$2 AND status='pending' RETURNING id", [input.organizationId, input.invitationId, input.actorId]) as { rows: Array<{ id: string }> };
      return result.rows.length === 1;
    });
  }

  async resend(input: { organizationId: string; invitationId: string; actorId: string; token: string; tokenHash: string; expiresAt: string }): Promise<boolean> {
    return withTenantDatabaseContext(this.pool, { userId: input.actorId, organizationId: input.organizationId }, async (client) => {
      const result = await client.query(`UPDATE organization_invitations i SET token_hash=$3,expires_at=$4,resend_count=resend_count+1,last_sent_at=now(),updated_at=now() FROM organizations o WHERE i.organization_id=$1 AND i.id=$2 AND i.organization_id=o.id AND i.status='pending' AND i.expires_at>now() AND i.last_sent_at<=now()-interval '1 minute' AND i.resend_count<10 RETURNING i.email,i.resend_count,o.name`, [input.organizationId, input.invitationId, input.tokenHash, input.expiresAt]) as { rows: Array<{ email: string; resend_count: number; name: string }> };
      const row = result.rows[0];
      if (!row) return false;
      const url = new URL("/accept-invitation", this.applicationUrl); url.searchParams.set("token", input.token);
      const message = createOrganizationInvitationEmail({ recipientEmail: row.email, organizationName: row.name, actionUrl: url.toString(), idempotencyKey: `organization-invitation:${input.invitationId}:resend:${row.resend_count}` });
      await client.query(`INSERT INTO transactional_email_messages(id,organization_id,invitation_id,kind,recipient_email,subject,text_body,html_body,idempotency_key) VALUES($1,$2,$3,$4,lower($5),$6,$7,$8,$9)`, [generateEntityId("tem"), input.organizationId, input.invitationId, message.kind, message.recipientEmail, message.subject, message.textBody, message.htmlBody, message.idempotencyKey]);
      return true;
    });
  }
}

export class QueuedInvitationEmailSender implements InvitationEmailSender {
  constructor(private readonly emailQueue: PostgresTransactionalEmailQueue, private readonly applicationUrl: string) {}
  async queue(input: { email: string; organizationName: string; token: string; invitationId: string }): Promise<void> {
    const url = new URL("/accept-invitation", this.applicationUrl);
    url.searchParams.set("token", input.token);
    await this.emailQueue.enqueue(createOrganizationInvitationEmail({ recipientEmail: input.email, organizationName: input.organizationName, actionUrl: url.toString(), idempotencyKey: `organization-invitation:${input.invitationId}` }));
  }
}
