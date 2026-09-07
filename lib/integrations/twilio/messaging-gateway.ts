import twilio from "twilio";

import {
  validateOutboundMessage,
  OutboundMessageDeliveryError,
  type OutboundMessageGateway,
  type OutboundMessageReceipt,
  type OutboundMessageRequest,
} from "@/lib/integrations/communications";

export interface TwilioMessageTransport {
  create(input: {
    to: string; body: string; statusCallback: string;
    from?: string; messagingServiceSid?: string;
  }): Promise<{ sid: string; status: string; dateCreated?: Date | null }>;
}

export interface TwilioMessagingConfiguration {
  accountSid: string;
  authToken: string;
  statusCallbackUrl: string;
  from?: string;
  messagingServiceSid?: string;
}

export class TwilioMessagingGateway implements OutboundMessageGateway {
  private readonly transport: TwilioMessageTransport;

  constructor(
    private readonly configuration: TwilioMessagingConfiguration,
    transport?: TwilioMessageTransport,
  ) {
    if (!!configuration.from === !!configuration.messagingServiceSid) {
      throw new Error("Configure exactly one Twilio sender or Messaging Service.");
    }
    if (!configuration.statusCallbackUrl.startsWith("https://")) {
      throw new Error("Twilio status callbacks require a public HTTPS URL.");
    }
    this.transport = transport ?? createTransport(configuration);
  }

  async send(request: OutboundMessageRequest): Promise<OutboundMessageReceipt> {
    validateOutboundMessage(request);
    let message: { sid: string; status: string; dateCreated?: Date | null };
    try {
      message = await this.transport.create({
        to: request.to,
        body: request.body.trim(),
        statusCallback: this.configuration.statusCallbackUrl,
        ...(this.configuration.from ? { from: this.configuration.from } : {}),
        ...(this.configuration.messagingServiceSid
          ? { messagingServiceSid: this.configuration.messagingServiceSid }
          : {}),
      });
    } catch (error) {
      const status = providerHttpStatus(error);
      throw new OutboundMessageDeliveryError(status && status >= 400 && status < 500
        ? "provider-rejected" : "provider-result-unknown");
    }
    if (!message.sid?.trim() || !message.status?.trim()) throw new OutboundMessageDeliveryError("provider-result-unknown");
    return {
      provider: "twilio",
      providerMessageId: message.sid,
      acceptedAt: (message.dateCreated ?? new Date()).toISOString(),
      providerStatus: message.status,
    };
  }
}

function providerHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function createTransport(configuration: TwilioMessagingConfiguration): TwilioMessageTransport {
  const client = twilio(configuration.accountSid, configuration.authToken);
  return { create: (input) => client.messages.create(input) };
}
