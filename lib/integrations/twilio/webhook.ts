import twilio from "twilio";

export interface TwilioWebhookRoute {
  integrationId: string; organizationId: string; locationId?: string;
  credentialReference: string; publicBaseUrl: string;
}

export type TwilioFormParameters = Record<string, string | string[]>;
export type TwilioEvent =
  | { kind: "inbound-message"; eventId: string; accountSid: string; from: string; to: string; body: string; occurredAt: string }
  | { kind: "message-status"; eventId: string; accountSid: string; status: "sent" | "delivered" | "failed"; occurredAt: string };

export class TwilioWebhookError extends Error {
  constructor(readonly code: "invalid-form" | "unsupported-event", message: string) { super(message); this.name = "TwilioWebhookError"; }
}

export function collectTwilioForm(searchParams: URLSearchParams): TwilioFormParameters {
  const result: TwilioFormParameters = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0]! : values;
  }
  return result;
}

export function verifyTwilioSignature(input: {
  authToken: string; signature: string; url: string; parameters: TwilioFormParameters;
}): boolean {
  if (!input.authToken || !input.signature) return false;
  return twilio.validateRequest(input.authToken, input.signature, input.url, input.parameters);
}

export function normalizeTwilioEvent(parameters: TwilioFormParameters, receivedAt = new Date()): TwilioEvent {
  const value = (key: string) => typeof parameters[key] === "string" ? parameters[key] : undefined;
  const eventId = value("MessageSid"); const accountSid = value("AccountSid");
  if (!eventId || !accountSid) throw new TwilioWebhookError("invalid-form", "MessageSid and AccountSid are required.");
  const occurredAt = receivedAt.toISOString();
  const messageStatus = value("MessageStatus");
  if (messageStatus) {
    const status = mapStatus(messageStatus);
    if (!status) throw new TwilioWebhookError("unsupported-event", "This message status does not change the DealerFlow record.");
    return { kind: "message-status", eventId, accountSid, status, occurredAt };
  }
  const from = value("From"); const to = value("To"); const body = value("Body");
  if (!from || !to || body === undefined) throw new TwilioWebhookError("invalid-form", "Inbound message fields are incomplete.");
  return { kind: "inbound-message", eventId, accountSid, from, to, body: body.slice(0, 1000), occurredAt };
}

function mapStatus(status: string): "sent" | "delivered" | "failed" | undefined {
  if (status === "sent") return "sent";
  if (status === "delivered" || status === "read") return "delivered";
  if (status === "failed" || status === "undelivered") return "failed";
  return undefined;
}
