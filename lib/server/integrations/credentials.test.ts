import { afterEach, describe, expect, it } from "vitest";
import { EnvironmentIntegrationCredentialResolver } from "./credentials";

const key = "DEALERFLOW_INTEGRATION_SECRET_TWILIO_DEMO";
afterEach(() => { delete process.env[key]; });

describe("EnvironmentIntegrationCredentialResolver", () => {
  it("resolves only explicitly prefixed integration secrets", async () => {
    process.env[key] = "secret-token";
    await expect(new EnvironmentIntegrationCredentialResolver().resolve("TWILIO_DEMO")).resolves.toBe("secret-token");
  });
  it("rejects unsafe references and unavailable credentials", async () => {
    const resolver = new EnvironmentIntegrationCredentialResolver();
    await expect(resolver.resolve("../DATABASE_URL")).rejects.toThrow("reference is invalid");
    await expect(resolver.resolve("TWILIO_MISSING")).rejects.toThrow("unavailable");
  });
});
