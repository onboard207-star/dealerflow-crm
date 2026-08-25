import twilio from "twilio";
import { describe, expect, it } from "vitest";

import { collectTwilioForm, normalizeTwilioEvent, TwilioWebhookError, verifyTwilioSignature } from "./webhook";

describe("Twilio webhook boundary", () => {
  it("validates the exact canonical URL and all form parameters with the official SDK", () => {
    const authToken = "twilio-test-token";
    const url = "https://crm.example.com/api/webhooks/twilio/abcdefghijklmnopqrstuvwxyz123456";
    const parameters = { AccountSid: "AC123", MessageSid: "SM123", Body: "Hello" };
    const signature = twilio.getExpectedTwilioSignature(authToken, url, parameters);
    expect(verifyTwilioSignature({ authToken, signature, url, parameters })).toBe(true);
    expect(verifyTwilioSignature({ authToken, signature, url: `${url}/changed`, parameters })).toBe(false);
  });

  it("preserves repeated and future parameters for signature validation", () => {
    const form = collectTwilioForm(new URLSearchParams("MediaUrl=a&MediaUrl=b&FutureField=value"));
    expect(form).toEqual({ MediaUrl: ["a", "b"], FutureField: "value" });
  });

  it("normalizes inbound messages and terminal status callbacks", () => {
    const receivedAt = new Date("2026-08-23T12:00:00.000Z");
    expect(normalizeTwilioEvent({ AccountSid: "AC1", MessageSid: "SM1", From: "+12075550184", To: "+12075550199", Body: "Interested" }, receivedAt))
      .toMatchObject({ kind: "inbound-message", eventId: "SM1", body: "Interested" });
    expect(normalizeTwilioEvent({ AccountSid: "AC1", MessageSid: "SM2", MessageStatus: "undelivered" }, receivedAt))
      .toMatchObject({ kind: "message-status", status: "failed" });
  });

  it("ignores non-material status transitions", () => {
    expect(() => normalizeTwilioEvent({ AccountSid: "AC1", MessageSid: "SM1", MessageStatus: "queued" }))
      .toThrow(TwilioWebhookError);
  });
});
