import { describe, expect, it } from "vitest";
import { inspectOptionalRuntimeCapabilities } from "./runtime-capabilities";

describe("optional runtime capability inspection", () => {
  it("reports optional providers without making them core readiness requirements", () => {
    expect(inspectOptionalRuntimeCapabilities({ APP_ENV: "staging" })).toEqual({
      ai: "not-configured",
      media: "not-configured",
      alerting: "not-configured",
    });
  });

  it("requires complete valid configuration before reporting a capability configured", () => {
    const source = {
      APP_ENV: "staging",
      DEALERFLOW_AI_PROVIDER: "openai",
      OPENAI_API_KEY: "test-provider-key",
      DEALERFLOW_AI_MODEL: "gpt-5.6",
      DEALERFLOW_MEDIA_PROVIDER: "r2",
      CLOUDFLARE_R2_ACCOUNT_ID: "a".repeat(32),
      CLOUDFLARE_R2_ACCESS_KEY_ID: "access-key",
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: "secret-key",
      CLOUDFLARE_R2_BUCKET: "dealerflow-media",
      CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://media.dealerflow.ai",
      DEALERFLOW_ALERT_WEBHOOK_URL: "https://alerts.dealerflow.ai/events",
      DEALERFLOW_ALERT_WEBHOOK_SECRET: "a-secure-alert-secret-that-is-long-enough",
    };
    expect(inspectOptionalRuntimeCapabilities(source)).toEqual({ ai: "configured", media: "configured", alerting: "configured" });
    expect(inspectOptionalRuntimeCapabilities({ ...source, CLOUDFLARE_R2_BUCKET: undefined }).media).toBe("not-configured");
  });
});
