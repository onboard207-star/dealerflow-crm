import { describe, expect, it, vi } from "vitest";
import { OutboundMessageValidationError } from "@/lib/integrations/communications";
import { TwilioMessagingGateway, type TwilioMessageTransport } from "./messaging-gateway";

function gateway(transport: TwilioMessageTransport) {
  return new TwilioMessagingGateway({ accountSid: "ACtest", authToken: "secret",
    from: "+12075550199", statusCallbackUrl: "https://crm.example.com/api/webhooks/twilio/key" }, transport);
}
const request = { to: "+12075550184", body: "Your appointment is confirmed.", idempotencyKey: "message:1",
  consent: { basis: "express-written" as const, capturedAt: "2026-08-23T12:00:00.000Z", evidenceReference: "consent_1" } };

describe("TwilioMessagingGateway", () => {
  it("sends through an injected transport with a signed-callback destination", async () => {
    const create = vi.fn<TwilioMessageTransport["create"]>().mockResolvedValue({ sid: "SM1", status: "queued", dateCreated: new Date("2026-08-23T12:01:00.000Z") });
    const receipt = await gateway({ create }).send(request);
    expect(create).toHaveBeenCalledWith({ to: request.to, body: request.body,
      from: "+12075550199", statusCallback: "https://crm.example.com/api/webhooks/twilio/key" });
    expect(receipt).toMatchObject({ provider: "twilio", providerMessageId: "SM1" });
  });
  it("requires valid destination, content, idempotency, and consent evidence", async () => {
    const transport = { create: vi.fn<TwilioMessageTransport["create"]>() };
    await expect(gateway(transport).send({ ...request, to: "2075550184", body: "", consent: { ...request.consent, evidenceReference: "" } }))
      .rejects.toBeInstanceOf(OutboundMessageValidationError);
    expect(transport.create).not.toHaveBeenCalled();
  });
  it("rejects ambiguous sender configuration", () => {
    expect(() => new TwilioMessagingGateway({ accountSid: "AC", authToken: "secret",
      from: "+12075550199", messagingServiceSid: "MG1", statusCallbackUrl: "https://crm.example.com/status" }, { create: vi.fn() }))
      .toThrow("exactly one");
  });
});
