import { randomBytes, createHash } from "node:crypto";
import type { AuthorizationActor } from "@/lib/platform/auth";
import { assertAuthorized } from "@/lib/platform/auth";

export interface InvitationOperationsProvider {
  revoke(input: { organizationId: string; invitationId: string; actorId: string }): Promise<boolean>;
  resend(input: { organizationId: string; invitationId: string; actorId: string; token: string; tokenHash: string; expiresAt: string }): Promise<boolean>;
}
export class InvitationOperationError extends Error {}

export class ManageInvitationsService {
  constructor(private readonly provider: InvitationOperationsProvider) {}
  async revoke(actor: AuthorizationActor, organizationId: string, invitationId: string): Promise<void> {
    assertAuthorized(actor, { organizationId, capability: "staff.manage" });
    assertInvitationId(invitationId);
    if (!await this.provider.revoke({ organizationId, invitationId, actorId: actor.userId })) throw new InvitationOperationError("Only a pending invitation can be revoked.");
  }
  async resend(actor: AuthorizationActor, organizationId: string, invitationId: string): Promise<void> {
    assertAuthorized(actor, { organizationId, capability: "staff.manage" });
    assertInvitationId(invitationId);
    const token = `${organizationId}.${randomBytes(32).toString("base64url")}`;
    const sent = await this.provider.resend({ organizationId, invitationId, actorId: actor.userId, token, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    if (!sent) throw new InvitationOperationError("The invitation cannot be resent yet or is no longer pending.");
  }
}
function assertInvitationId(value: string) { if (!/^oin_[a-z0-9_-]{6,64}$/.test(value)) throw new InvitationOperationError("A valid invitation is required."); }
