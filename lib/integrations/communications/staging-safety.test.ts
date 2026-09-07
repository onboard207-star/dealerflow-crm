import { describe, expect, it, vi } from "vitest";
import { assertStagingDemoTenant, assertStagingSenderAllowed, parseStagingDestinationAllowlist,
  StagingCommunicationSafetyError, StagingRestrictedMessageGateway } from "./staging-safety";

describe("staging communication safety", () => {
  it("requires valid non-empty exact destination allowlists", () => {
    expect([...parseStagingDestinationAllowlist("+12075550101,+12075550102", "sms")]).toEqual(["+12075550101", "+12075550102"]);
    expect([...parseStagingDestinationAllowlist("Test@Example.com", "email")]).toEqual(["test@example.com"]);
    expect(() => parseStagingDestinationAllowlist("", "sms")).toThrow(StagingCommunicationSafetyError);
    expect(() => parseStagingDestinationAllowlist("not-a-phone", "sms")).toThrow(StagingCommunicationSafetyError);
  });

  it("requires demo data and an allowlisted sender", () => {
    expect(() => assertStagingDemoTenant("pilot")).toThrowError(expect.objectContaining({ code: "tenant-blocked" }));
    expect(() => assertStagingSenderAllowed("+12075550199", new Set(["+12075550198"]))).toThrowError(expect.objectContaining({ code: "sender-blocked" }));
  });

  it("refuses arbitrary recipients before invoking the provider", async () => {
    const send = vi.fn().mockResolvedValue({ provider: "test", providerMessageId: "SM1", providerStatus: "queued", acceptedAt: new Date().toISOString() });
    const gateway = new StagingRestrictedMessageGateway({ send }, new Set(["+12075550101"]));
    await expect(gateway.send({ to: "+12075550102", body: "Synthetic staging message", idempotencyKey: "test-1",
      consent: { basis: "express-written", capturedAt: new Date().toISOString(), evidenceReference: "synthetic" } }))
      .rejects.toThrowError(expect.objectContaining({ code: "destination-blocked" }));
    expect(send).not.toHaveBeenCalled();
  });
});
