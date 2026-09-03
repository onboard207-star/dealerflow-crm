import { describe, expect, it } from "vitest";

import {
  AuthorizationError,
  assertAuthorized,
  authorize,
  type AuthorizationActor,
} from "./authorization";

const salesperson: AuthorizationActor = {
  userId: "user_sales_001",
  memberships: [
    {
      organizationId: "org_dealerflow_demo",
      locationIds: ["loc_portland"],
      capabilities: [
        "customer.read",
        "lead.read",
        "lead.update",
        "task.create",
      ],
    },
  ],
};

describe("authorize", () => {
  it("allows a capability inside the actor's organization and location", () => {
    const decision = authorize(salesperson, {
      organizationId: "org_dealerflow_demo",
      locationId: "loc_portland",
      capability: "lead.update",
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies cross-tenant access even when the capability exists elsewhere", () => {
    const decision = authorize(salesperson, {
      organizationId: "org_other_dealer",
      locationId: "loc_portland",
      capability: "lead.update",
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "organization-membership-required",
    });
  });

  it("denies access to a location outside the membership", () => {
    const decision = authorize(salesperson, {
      organizationId: "org_dealerflow_demo",
      locationId: "loc_boston",
      capability: "lead.read",
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "location-access-required",
    });
  });

  it("denies a missing capability", () => {
    const decision = authorize(salesperson, {
      organizationId: "org_dealerflow_demo",
      capability: "deal.approve",
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "capability-required",
    });
  });

  it("supports organization-wide location access", () => {
    const manager: AuthorizationActor = {
      userId: "user_manager_001",
      memberships: [
        {
          organizationId: "org_dealerflow_demo",
          locationIds: "all",
          capabilities: ["reports.view"],
        },
      ],
    };

    expect(
      authorize(manager, {
        organizationId: "org_dealerflow_demo",
        locationId: "loc_anywhere",
        capability: "reports.view",
      }).allowed,
    ).toBe(true);
  });

  it("does not inherit quote approval from generic deal approval", () => {
    const actor: AuthorizationActor = {
      userId: "user_manager_002",
      memberships: [{
        organizationId: "org_dealerflow_demo",
        locationIds: "all",
        capabilities: ["deal.read", "deal.update", "deal.approve"],
      }],
    };

    expect(authorize(actor, {
      organizationId: "org_dealerflow_demo",
      capability: "quote.approve",
    })).toEqual({ allowed: false, reason: "capability-required" });
  });

  it("allows quote approval only with the dedicated capability", () => {
    const actor: AuthorizationActor = {
      userId: "user_manager_003",
      memberships: [{
        organizationId: "org_dealerflow_demo",
        locationIds: "all",
        capabilities: ["deal.read", "quote.approve"],
      }],
    };

    expect(authorize(actor, {
      organizationId: "org_dealerflow_demo",
      capability: "quote.approve",
    }).allowed).toBe(true);
  });
});

describe("assertAuthorized", () => {
  it("returns the matching membership when access is allowed", () => {
    const membership = assertAuthorized(salesperson, {
      organizationId: "org_dealerflow_demo",
      capability: "customer.read",
    });

    expect(membership.organizationId).toBe("org_dealerflow_demo");
  });

  it("throws a safe authorization error without record details", () => {
    expect(() =>
      assertAuthorized(salesperson, {
        organizationId: "org_other_dealer",
        capability: "customer.read",
      }),
    ).toThrow(AuthorizationError);

    try {
      assertAuthorized(salesperson, {
        organizationId: "org_other_dealer",
        capability: "customer.read",
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
    }
  });
});
