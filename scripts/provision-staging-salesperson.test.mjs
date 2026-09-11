import { describe, expect, it, vi } from "vitest";

import { parseStagingSalespersonArguments, provisionStagingSalesperson } from "./provision-staging-salesperson.mjs";

const args = [
  "--confirm", "PROVISION-SYNTHETIC-STAGING-SALESPERSON",
  "--email", "synthetic+salesperson@example.com",
  "--organization-id", "org_demo_first_pilot_v1",
  "--location-id", "loc_demo_main_rooftop_v1",
  "--application-url", "https://dealerflow-isolated-staging.onrender.com",
  "--expected-database-host", "isolated.example.internal",
];

describe("staging Salesperson provisioner", () => {
  it.each(["production", "development", "test", undefined])("refuses APP_ENV=%s", (appEnvironment) => {
    expect(() => parseStagingSalespersonArguments(args, {
      APP_ENV: appEnvironment,
      DATABASE_URL: "postgresql://user:secret@isolated.example.internal/database",
    })).toThrow("disabled outside APP_ENV=staging");
  });

  it("requires an exact database host and explicit confirmation", () => {
    expect(() => parseStagingSalespersonArguments(args, {
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:secret@unexpected.example.internal/database",
    })).toThrow("does not match");
    expect(() => parseStagingSalespersonArguments(args.with(1, "WRONG"), {
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:secret@isolated.example.internal/database",
    })).toThrow("--confirm must equal");
  });

  it("accepts only the established database TLS modes", () => {
    expect(() => parseStagingSalespersonArguments(args, {
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:secret@isolated.example.internal/database",
      DATABASE_SSL_MODE: "require",
    })).toThrow("DATABASE_SSL_MODE must be disable or verify-full");
    expect(parseStagingSalespersonArguments(args, {
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:secret@isolated.example.internal/database",
      DATABASE_SSL_MODE: "disable",
    }).databaseSslMode).toBe("disable");
  });

  it("rejects a non-synthetic email", () => {
    expect(() => parseStagingSalespersonArguments(args.with(3, "person@example.com"), {
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:secret@isolated.example.internal/database",
    })).toThrow("plus-addressed");
  });

  it("creates only an invitation, scoped Salesperson role, location grant, outbox message, and audit evidence", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org", location_id: "loc", role_id: "rol_sales" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });
    const client = { query, release: vi.fn() };
    const result = await provisionStagingSalesperson({ connect: vi.fn().mockResolvedValue(client) }, {
      applicationUrl: "https://staging.example.com",
      email: "synthetic+salesperson@example.com",
      organizationId: "org_demo_first_pilot_v1",
      locationId: "loc_demo_main_rooftop_v1",
    });
    expect(result.status).toBe("invitation-created");
    const calls = query.mock.calls;
    const sql = calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("organization.data_class='demo'");
    expect(calls.find(([statement]) => String(statement).includes("JOIN roles"))?.[1]).toEqual(["org_demo_first_pilot_v1", "loc_demo_main_rooftop_v1", "salesperson"]);
    expect(sql).toContain("organization_invitation_locations");
    expect(sql).toContain("transactional_email_messages");
    expect(calls.some(([, values]) => values?.includes("staging.synthetic_salesperson.provisioning_requested"))).toBe(true);
    expect(sql).not.toContain("INSERT INTO auth_accounts");
    expect(client.release).toHaveBeenCalled();
  });
});

describe("staging Manager provisioner", () => {
  const managerArgs = [
    "--role-key", "general-manager",
    "--confirm", "PROVISION-SYNTHETIC-STAGING-MANAGER",
    "--email", "synthetic+manager@example.com",
    "--organization-id", "org_demo_first_pilot_v1",
    "--location-id", "loc_demo_main_rooftop_v1",
    "--application-url", "https://dealerflow-isolated-staging.onrender.com",
    "--expected-database-host", "isolated.example.internal",
  ];

  it("requires the Manager-specific confirmation and rejects unsupported roles", () => {
    const environment = { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@isolated.example.internal/database" };
    expect(() => parseStagingSalespersonArguments(managerArgs.with(3, "PROVISION-SYNTHETIC-STAGING-SALESPERSON"), environment)).toThrow("PROVISION-SYNTHETIC-STAGING-MANAGER");
    expect(() => parseStagingSalespersonArguments(managerArgs.with(1, "platform-administrator"), environment)).toThrow("salesperson, sales-manager, general-manager, or finance-manager");
    expect(() => parseStagingSalespersonArguments([...managerArgs, "--setup-link-confirm", "WRONG"], environment)).toThrow("RETURN-ONE-TIME-SETUP-LINK");
    expect(parseStagingSalespersonArguments([...managerArgs, "--setup-link-confirm", "RETURN-ONE-TIME-SETUP-LINK"], environment).returnSetupUrl).toBe(true);
  });

  it("supports the canonical Finance Manager role through the governed invitation path", async () => {
    const financeArgs = managerArgs
      .with(1, "finance-manager")
      .with(3, "PROVISION-SYNTHETIC-STAGING-FINANCE-MANAGER")
      .with(5, "synthetic+finance-manager@example.com");
    const environment = { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@isolated.example.internal/database" };
    expect(parseStagingSalespersonArguments([...financeArgs, "--setup-link-confirm", "RETURN-ONE-TIME-SETUP-LINK"], environment)).toMatchObject({
      roleKey: "finance-manager",
      returnSetupUrl: true,
    });

    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org", location_id: "loc", role_id: "rol_finance" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });
    const client = { query, release: vi.fn() };
    const result = await provisionStagingSalesperson({ connect: vi.fn().mockResolvedValue(client) }, {
      applicationUrl: "https://staging.example.com",
      email: "synthetic+finance-manager@example.com",
      organizationId: "org_demo_first_pilot_v1",
      locationId: "loc_demo_main_rooftop_v1",
      roleKey: "finance-manager",
    });
    expect(result).toMatchObject({ status: "invitation-created", roleKey: "finance-manager" });
    expect(query.mock.calls.find(([statement]) => String(statement).includes("JOIN roles"))?.[1]).toEqual(["org_demo_first_pilot_v1", "loc_demo_main_rooftop_v1", "finance-manager"]);
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(query.mock.calls.some(([, values]) => values?.includes("staging.synthetic_finance_manager.provisioning_requested"))).toBe(true);
    expect(sql).not.toContain("INSERT INTO auth_accounts");
    expect(sql).not.toContain("INSERT INTO auth_sessions");
  });

  it("returns structured recovery reasons for an incomplete existing user", async () => {
    const query = vi.fn(async (statement) => {
      if (String(statement).includes("JOIN roles")) return { rows: [{ organization_id: "org", location_id: "loc", role_id: "rol_finance", role_capabilities: [] }] };
      if (String(statement).startsWith("SELECT id,email_verified")) return { rows: [{ id: "usr_finance", email_verified: false, active: false }] };
      if (String(statement).startsWith("SELECT 1 FROM auth_accounts")) return { rows: [] };
      if (String(statement).includes("FROM organization_memberships membership")) return { rows: [] };
      return { rows: [] };
    });
    const client = { query, release: vi.fn() };
    const result = await provisionStagingSalesperson({ connect: vi.fn().mockResolvedValue(client) }, {
      applicationUrl: "https://staging.example.com",
      email: "synthetic+finance-manager@example.com",
      organizationId: "org_demo_first_pilot_v1",
      locationId: "loc_demo_main_rooftop_v1",
      roleKey: "finance-manager",
    });
    expect(result).toMatchObject({
      status: "existing-user-incomplete",
      roleKey: "finance-manager",
      reasons: ["user-inactive", "email-unverified", "credential-account-missing", "membership-missing"],
    });
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).not.toContain("INSERT INTO auth_accounts");
    expect(sql).not.toContain("INSERT INTO auth_sessions");
  });

  it("creates one canonical General Manager invitation without creating auth records", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org", location_id: "loc", role_id: "rol_manager" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });
    const client = { query, release: vi.fn() };
    const result = await provisionStagingSalesperson({ connect: vi.fn().mockResolvedValue(client) }, {
      applicationUrl: "https://staging.example.com",
      email: "synthetic+manager@example.com",
      organizationId: "org_demo_first_pilot_v1",
      locationId: "loc_demo_main_rooftop_v1",
      roleKey: "general-manager",
    });
    expect(result).toMatchObject({ status: "invitation-created", roleKey: "general-manager" });
    const calls = query.mock.calls;
    expect(calls.find(([statement]) => String(statement).includes("JOIN roles"))?.[1]).toEqual(["org_demo_first_pilot_v1", "loc_demo_main_rooftop_v1", "general-manager"]);
    const sql = calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("organization.data_class='demo'");
    expect(sql).toContain("organization_invitation_roles");
    expect(sql).toContain("organization_invitation_locations");
    expect(calls.some(([, values]) => values?.includes("staging.synthetic_manager.provisioning_requested"))).toBe(true);
    expect(sql).not.toContain("INSERT INTO auth_accounts");
    expect(sql).not.toContain("INSERT INTO auth_sessions");
  });

  it("reconciles an authenticated existing Manager to the exact canonical role and location", async () => {
    const query = vi.fn(async (statement) => {
      if (String(statement).includes("JOIN roles")) return { rows: [{ organization_id: "org", location_id: "loc", role_id: "rol_manager", role_capabilities: ["deal.approve"] }] };
      if (String(statement).startsWith("SELECT id,email_verified")) return { rows: [{ id: "usr_manager", email_verified: true, active: true }] };
      if (String(statement).startsWith("SELECT 1 FROM auth_accounts")) return { rows: [{ one: 1 }] };
      if (String(statement).startsWith("INSERT INTO organization_memberships")) return { rows: [{ id: "mem_manager" }] };
      return { rows: [] };
    });
    const client = { query, release: vi.fn() };
    const result = await provisionStagingSalesperson({ connect: vi.fn().mockResolvedValue(client) }, {
      applicationUrl: "https://staging.example.com",
      email: "synthetic+manager@example.com",
      organizationId: "org_demo_first_pilot_v1",
      locationId: "loc_demo_main_rooftop_v1",
      roleKey: "general-manager",
    });
    expect(result).toMatchObject({ status: "identity-reconciled", userId: "usr_manager", roleKey: "general-manager" });
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("INSERT INTO organization_memberships");
    expect(sql).toContain("DELETE FROM membership_roles");
    expect(sql).toContain("INSERT INTO membership_roles");
    expect(sql).toContain("DELETE FROM membership_locations");
    expect(sql).toContain("INSERT INTO membership_locations");
    expect(sql).toContain("DELETE FROM role_capabilities");
    expect(sql).toContain("INSERT INTO role_capabilities");
    expect(query.mock.calls.some(([, values]) => values?.includes("staging.synthetic_general_manager.identity_reconciled"))).toBe(true);
    expect(query.mock.calls.some(([, values]) => values?.includes("staging.synthetic_general_manager.role_capabilities_reconciled"))).toBe(true);
    expect(sql).not.toContain("INSERT INTO auth_accounts");
    expect(sql).not.toContain("INSERT INTO auth_sessions");
  });

  it("reuses an existing Manager invitation instead of creating a duplicate", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org", location_id: "loc", role_id: "rol_manager" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "oin_existing", status: "pending", expires_at: new Date() }] })
      .mockResolvedValue({ rows: [] });
    const client = { query, release: vi.fn() };
    const result = await provisionStagingSalesperson({ connect: vi.fn().mockResolvedValue(client) }, {
      applicationUrl: "https://staging.example.com",
      email: "synthetic+manager@example.com",
      organizationId: "org_demo_first_pilot_v1",
      locationId: "loc_demo_main_rooftop_v1",
      roleKey: "general-manager",
    });
    expect(result).toMatchObject({ status: "invitation-exists", roleKey: "general-manager" });
    expect(query.mock.calls.map(([statement]) => statement).join("\n")).not.toContain("INSERT INTO organization_invitations");
  });

  it("rotates the existing invitation token before returning a one-time setup URL", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ organization_id: "org", location_id: "loc", role_id: "rol_manager" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "oin_existing", status: "pending", expires_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ resend_count: 1 }] })
      .mockResolvedValue({ rows: [] });
    const client = { query, release: vi.fn() };
    const result = await provisionStagingSalesperson({ connect: vi.fn().mockResolvedValue(client) }, {
      applicationUrl: "https://staging.example.com",
      email: "synthetic+manager@example.com",
      organizationId: "org_demo_first_pilot_v1",
      locationId: "loc_demo_main_rooftop_v1",
      roleKey: "general-manager",
      returnSetupUrl: true,
    });
    expect(result.status).toBe("setup-link-rotated");
    expect(result.setupUrl).toMatch(/^https:\/\/staging\.example\.com\/accept-invitation\?token=org_demo_first_pilot_v1\./);
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("UPDATE organization_invitations SET token_hash");
    expect(sql).not.toContain("INSERT INTO organization_invitations");
    expect(query.mock.calls.some(([, values]) => values?.includes("staging.synthetic_manager.setup_link_rotated"))).toBe(true);
  });
});
