import { describe, expect, it, vi } from "vitest";
import { ResendTransactionalEmailGateway, TransactionalEmailDeliveryError } from "./resend-gateway";

const message = {
  kind: "email-verification" as const,
  recipientEmail: "alex@example.com",
  subject: "Verify",
  textBody: "Verify account",
  htmlBody: "<p>Verify account</p>",
  idempotencyKey: "email-verification:token-1",
};

describe("ResendTransactionalEmailGateway", () => {
  it("sends the provider-neutral message with an idempotency key", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
    const gateway = new ResendTransactionalEmailGateway({ apiKey: "secret", from: "DealerFlow <account@example.com>", fetch: request });
    await expect(gateway.send(message)).resolves.toEqual({ providerMessageId: "email_123" });
    expect(request).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "idempotency-key": message.idempotencyKey }) }));
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ to: ["alex@example.com"], subject: "Verify" });
  });

  it("returns sanitized provider errors", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive provider detail", { status: 422 }));
    const gateway = new ResendTransactionalEmailGateway({ apiKey: "secret", from: "account@example.com", fetch: request });
    await expect(gateway.send(message)).rejects.toEqual(new TransactionalEmailDeliveryError("provider-http-422"));
  });
});
