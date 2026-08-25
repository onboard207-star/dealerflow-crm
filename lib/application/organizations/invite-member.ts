import { createHash, randomBytes } from "node:crypto";
import type { AuthorizationActor } from "@/lib/platform/auth";
import { assertAuthorized } from "@/lib/platform/auth";

export interface InviteMemberInput {
  actor: AuthorizationActor;
  organizationId: string;
  email: string;
  roleIds: readonly string[];
  locationIds: readonly string[];
  allLocations: boolean;
  idempotencyKey: string;
}
export interface InvitationDraft extends Omit<InviteMemberInput, "actor"> { tokenHash: string; deliveryToken: string; expiresAt: string; invitedBy: string }
export interface InvitationProvider { create(draft: InvitationDraft): Promise<{ invitationId: string; organizationName: string; created: boolean; emailQueued: boolean }> }
export interface InvitationEmailSender { queue(input: { email: string; organizationName: string; token: string; invitationId: string }): Promise<void> }

export class InvitationValidationError extends Error {}

export class InviteMemberService {
  constructor(private readonly provider: InvitationProvider, private readonly email: InvitationEmailSender) {}
  async invite(input: InviteMemberInput): Promise<{ invitationId: string }> {
    assertAuthorized(input.actor, { organizationId: input.organizationId, capability: "staff.manage" });
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvitationValidationError("A valid email is required.");
    if (input.roleIds.length < 1 || new Set(input.roleIds).size !== input.roleIds.length) throw new InvitationValidationError("At least one unique role is required.");
    if (!input.allLocations && input.locationIds.length < 1) throw new InvitationValidationError("At least one location is required.");
    if (new Set(input.locationIds).size !== input.locationIds.length) throw new InvitationValidationError("Locations must be unique.");
    if (!/^[A-Za-z0-9:_-]{8,200}$/.test(input.idempotencyKey)) throw new InvitationValidationError("A valid idempotency key is required.");
    const token = `${input.organizationId}.${randomBytes(32).toString("base64url")}`;
    const created = await this.provider.create({ ...input, email, invitedBy: input.actor.userId, tokenHash: createHash("sha256").update(token).digest("hex"), deliveryToken: token, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    if (created.created && !created.emailQueued) await this.email.queue({ email, organizationName: created.organizationName, token, invitationId: created.invitationId });
    return { invitationId: created.invitationId };
  }
}
