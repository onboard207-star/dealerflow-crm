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
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("organization.data_class='demo'");
    expect(sql).toContain("role.key='salesperson'");
    expect(sql).toContain("organization_invitation_locations");
    expect(sql).toContain("transactional_email_messages");
    expect(sql).toContain("staging.synthetic_salesperson.provisioning_requested");
    expect(sql).not.toContain("INSERT INTO auth_accounts");
    expect(client.release).toHaveBeenCalled();
  });
});
