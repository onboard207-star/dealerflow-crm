import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/lib/platform/auth";
import { InviteMemberService, InvitationValidationError, type InvitationProvider, type InvitationEmailSender } from "./invite-member";

const actor = { userId: "usr_adminuser", memberships: [{ organizationId: "org_dealerflow", locationIds: "all" as const, capabilities: ["staff.manage" as const] }] };
const input = { actor, organizationId: "org_dealerflow", email: " Alex@Example.com ", roleIds: ["rol_salesperson"], locationIds: ["loc_mainstore"], allLocations: false, idempotencyKey: "invite:request-123" };

describe("InviteMemberService", () => {
  it("normalizes identity, hashes a high-entropy token, and queues only the raw link token", async () => {
    const create = vi.fn<InvitationProvider["create"]>().mockResolvedValue({ invitationId: "oin_invitation1", organizationName: "DealerFlow Honda", created: true, emailQueued: false });
    const queue = vi.fn<InvitationEmailSender["queue"]>().mockResolvedValue();
    await expect(new InviteMemberService({ create }, { queue }).invite(input)).resolves.toEqual({ invitationId: "oin_invitation1" });
    expect(create.mock.calls[0]?.[0].email).toBe("alex@example.com");
    expect(create.mock.calls[0]?.[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(queue.mock.calls[0]?.[0].token).not.toBe(create.mock.calls[0]?.[0].tokenHash);
  });
  it("does not send a second email when an idempotent request already exists", async () => {
    const create = vi.fn<InvitationProvider["create"]>().mockResolvedValue({ invitationId: "oin_existing1", organizationName: "DealerFlow Honda", created: false, emailQueued: false });
    const queue = vi.fn<InvitationEmailSender["queue"]>();
    await new InviteMemberService({ create }, { queue }).invite(input);
    expect(queue).not.toHaveBeenCalled();
  });
  it("does not send outside the transaction when the provider atomically queued delivery", async () => {
    const create = vi.fn<InvitationProvider["create"]>().mockResolvedValue({ invitationId: "oin_atomic1", organizationName: "DealerFlow Honda", created: true, emailQueued: true });
    const queue = vi.fn<InvitationEmailSender["queue"]>();
    await new InviteMemberService({ create }, { queue }).invite(input);
    expect(queue).not.toHaveBeenCalled();
  });
  it("requires staff permission and constrained grants", async () => {
    const service = new InviteMemberService({ create: vi.fn() }, { queue: vi.fn() });
    await expect(service.invite({ ...input, actor: { ...actor, memberships: [] } })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(service.invite({ ...input, roleIds: [] })).rejects.toBeInstanceOf(InvitationValidationError);
    await expect(service.invite({ ...input, allLocations: false, locationIds: [] })).rejects.toBeInstanceOf(InvitationValidationError);
  });
});
