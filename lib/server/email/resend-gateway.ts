import type { TransactionalEmailGateway, TransactionalEmailMessage } from "@/lib/application/email";

export interface ResendGatewayConfiguration {
  apiKey: string;
  from: string;
  replyTo?: string;
  fetch?: typeof fetch;
}

export class TransactionalEmailDeliveryError extends Error {
  constructor(readonly code: string) {
    super("Transactional email delivery failed.");
    this.name = "TransactionalEmailDeliveryError";
  }
}

export class ResendTransactionalEmailGateway implements TransactionalEmailGateway {
  private readonly request: typeof fetch;
  constructor(private readonly configuration: ResendGatewayConfiguration) {
    this.request = configuration.fetch ?? fetch;
  }

  async send(message: TransactionalEmailMessage): Promise<{ providerMessageId: string }> {
    const response = await this.request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.configuration.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": message.idempotencyKey,
        "user-agent": "DealerFlow-AI/1.0",
      },
      body: JSON.stringify({
        from: this.configuration.from,
        to: [message.recipientEmail],
        subject: message.subject,
        text: message.textBody,
        html: message.htmlBody,
        ...(this.configuration.replyTo ? { reply_to: this.configuration.replyTo } : {}),
      }),
    });
    if (!response.ok) throw new TransactionalEmailDeliveryError(`provider-http-${response.status}`);
    const body: unknown = await response.json();
    if (!isProviderResponse(body)) throw new TransactionalEmailDeliveryError("provider-invalid-response");
    return { providerMessageId: body.id };
  }
}

function isProviderResponse(value: unknown): value is { id: string } {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" && value.id.length > 0;
}
