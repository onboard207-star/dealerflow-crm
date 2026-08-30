import { describe, expect, it } from "vitest";

import { assertProviderWorkspaceScope } from "./workspace-provider";

describe("provider workspace scope", () => {
  it("requires explicit tenant, actor, and location authority", () => {
    expect(() => assertProviderWorkspaceScope({ kind: "website-analytics", organizationId: "org_demo001", userId: "usr_admin001", locationIds: ["loc_main001"] })).not.toThrow();
    expect(() => assertProviderWorkspaceScope({ kind: "social-media", organizationId: "org_demo001", userId: "usr_admin001", locationIds: [] })).toThrow("location scope");
    expect(() => assertProviderWorkspaceScope({ kind: "social-media", organizationId: "org_other01", userId: "", locationIds: "all" })).toThrow("user scope");
  });
});
