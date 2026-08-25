import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import { IntegrationConfigurationError, ProvisionTwilioIntegrationService,
  type IntegrationConfigurationProvider, type IntegrationConfigurationSession,
  type TwilioIntegrationInput } from "./provision-twilio";

class Provider implements IntegrationConfigurationProvider, IntegrationConfigurationSession {
  webhookHash?: string;
  async transaction<Result>(operation: (session: IntegrationConfigurationSession) => Promise<Result>) { return operation(this); }
  async createTwilio(_context: RequestContext, input: TwilioIntegrationInput & { id: string; webhookKeyHash: string }) {
    this.webhookHash = input.webhookKeyHash; return { ...input, active: true };
  }
}
const actor: AuthorizationActor = { userId: "usr_admin", memberships: [{ organizationId: "org_dealerflow", locationIds: "all", capabilities: ["organization.configure"] }] };
const request = { actor, organizationId: "org_dealerflow", correlationId: "req_1",
  providerAccountId: `AC${"a".repeat(32)}`, credentialReference: "TWILIO_DEMO",
  publicBaseUrl: "https://crm.example.com", defaultFromAddress: "+12075550199" };

describe("ProvisionTwilioIntegrationService", () => {
  it("returns a one-time webhook key while persisting only its hash", async () => {
    const provider = new Provider(); const key = "a".repeat(43);
    const result = await new ProvisionTwilioIntegrationService(provider, () => key).provision(request);
    expect(result.webhookUrl).toBe(`https://crm.example.com/api/webhooks/twilio/${key}`);
    expect(provider.webhookHash).not.toBe(key); expect(provider.webhookHash).toHaveLength(64);
  });
  it("validates account, secret reference, HTTPS origin, and sender", async () => {
    await expect(new ProvisionTwilioIntegrationService(new Provider()).provision({ ...request,
      providerAccountId: "bad", credentialReference: "../SECRET", publicBaseUrl: "http://localhost",
      defaultFromAddress: "2075550199" })).rejects.toBeInstanceOf(IntegrationConfigurationError);
  });
  it("requires organization configuration permission", async () => {
    await expect(new ProvisionTwilioIntegrationService(new Provider()).provision({ ...request,
      actor: { ...actor, memberships: [{ ...actor.memberships[0]!, capabilities: [] }] } }))
      .rejects.toMatchObject({ name: "AuthorizationError" });
  });
  it("requires an all-locations membership for an organization-wide sender", async () => {
    await expect(new ProvisionTwilioIntegrationService(new Provider()).provision({ ...request,
      actor: { ...actor, memberships: [{ ...actor.memberships[0]!, locationIds: ["loc_main"] }] } }))
      .rejects.toMatchObject({ name: "AuthorizationError", reason: "location-access-required" });
  });
  it("allows a location-restricted administrator to provision an allowed location", async () => {
    const result = await new ProvisionTwilioIntegrationService(new Provider(), () => "a".repeat(43)).provision({
      ...request, locationId: "loc_main",
      actor: { ...actor, memberships: [{ ...actor.memberships[0]!, locationIds: ["loc_main"] }] },
    });
    expect(result.integration.locationId).toBe("loc_main");
  });
});
