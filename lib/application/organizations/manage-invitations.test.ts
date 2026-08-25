import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/lib/platform/auth";
import { InvitationOperationError, ManageInvitationsService, type InvitationOperationsProvider } from "./manage-invitations";

const actor = { userId:"usr_adminuser", memberships:[{organizationId:"org_dealerflow",locationIds:"all" as const,capabilities:["staff.manage" as const]}] };
describe("ManageInvitationsService",()=>{
  it("revokes only through the authorized tenant provider",async()=>{const revoke=vi.fn<InvitationOperationsProvider["revoke"]>().mockResolvedValue(true);const service=new ManageInvitationsService({revoke,resend:vi.fn()});await service.revoke(actor,"org_dealerflow","oin_invitation1");expect(revoke).toHaveBeenCalledWith({organizationId:"org_dealerflow",invitationId:"oin_invitation1",actorId:"usr_adminuser"});});
  it("rotates a high-entropy resend token without exposing its hash",async()=>{const resend=vi.fn<InvitationOperationsProvider["resend"]>().mockResolvedValue(true);await new ManageInvitationsService({revoke:vi.fn(),resend}).resend(actor,"org_dealerflow","oin_invitation1");const request=resend.mock.calls[0]?.[0];expect(request?.token).toMatch(/^org_dealerflow\.[A-Za-z0-9_-]{43}$/);expect(request?.tokenHash).toMatch(/^[a-f0-9]{64}$/);expect(request?.token).not.toContain(request?.tokenHash??"");});
  it("fails closed for missing permission and non-pending records",async()=>{const service=new ManageInvitationsService({revoke:vi.fn().mockResolvedValue(false),resend:vi.fn().mockResolvedValue(false)});await expect(service.revoke({...actor,memberships:[]},"org_dealerflow","oin_invitation1")).rejects.toBeInstanceOf(AuthorizationError);await expect(service.revoke(actor,"org_dealerflow","oin_invitation1")).rejects.toBeInstanceOf(InvitationOperationError);await expect(service.resend(actor,"org_dealerflow","oin_invitation1")).rejects.toBeInstanceOf(InvitationOperationError);});
});
