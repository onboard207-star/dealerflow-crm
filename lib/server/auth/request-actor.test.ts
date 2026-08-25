import { describe, expect, it } from "vitest";

import {
  MembershipError,
  resolveAuthorizationActor,
  type MembershipReader,
} from "./request-actor";

const userId = "usr_salesperson";
const organizationId = "org_dealerflow";

describe("resolveAuthorizationActor", () => {
  it("builds authorization from the live active membership", async () => {
    const reader: MembershipReader = {
      async readActiveMembership() {
        return {
          organizationId,
          allLocations: false,
          locationIds: ["loc_main"],
          capabilities: ["lead.create", "customer.read", "unknown.permission"],
        };
      },
    };

    const actor = await resolveAuthorizationActor(userId, organizationId, reader);

    expect(actor).toEqual({
      userId,
      memberships: [
        {
          organizationId,
          locationIds: ["loc_main"],
          capabilities: ["lead.create", "customer.read"],
        },
      ],
    });
  });

  it("supports explicit all-location membership", async () => {
    const reader: MembershipReader = {
      async readActiveMembership() {
        return {
          organizationId,
          allLocations: true,
          locationIds: [],
          capabilities: ["lead.read"],
        };
      },
    };

    const actor = await resolveAuthorizationActor(userId, organizationId, reader);

    expect(actor.memberships[0]?.locationIds).toBe("all");
  });

  it("fails closed when no active membership exists", async () => {
    const reader: MembershipReader = {
      async readActiveMembership() {
        return null;
      },
    };

    await expect(
      resolveAuthorizationActor(userId, "org_other", reader),
    ).rejects.toBeInstanceOf(MembershipError);
  });

  it("removes capabilities owned by disabled tenant modules",async()=>{const reader:MembershipReader={async readActiveMembership(){return{organizationId,allLocations:true,locationIds:[],capabilities:["customer.read","inventory.read","deal.read","organization.configure"],features:{crm:false,inventory:true,finance:false}}}};const actor=await resolveAuthorizationActor(userId,organizationId,reader);expect(actor.memberships[0]?.capabilities).toEqual(["inventory.read","organization.configure"]);});
});
