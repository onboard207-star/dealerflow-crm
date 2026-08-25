import twilio from "twilio";

import {
  validateOutboundMessage,
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
    const message = await this.transport.create({
      to: request.to,
      body: request.body.trim(),
      statusCallback: this.configuration.statusCallbackUrl,
      ...(this.configuration.from ? { from: this.configuration.from } : {}),
      ...(this.configuration.messagingServiceSid
        ? { messagingServiceSid: this.configuration.messagingServiceSid }
        : {}),
    });
    return {
      provider: "twilio",
      providerMessageId: message.sid,
      acceptedAt: (message.dateCreated ?? new Date()).toISOString(),
      providerStatus: message.status,
    };
  }
}

function createTransport(configuration: TwilioMessagingConfiguration): TwilioMessageTransport {
  const client = twilio(configuration.accountSid, configuration.authToken);
  return { create: (input) => client.messages.create(input) };
}
