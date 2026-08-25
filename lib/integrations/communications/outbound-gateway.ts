export interface OutboundMessageRequest {
  to: string;
  body: string;
  idempotencyKey: string;
  consent: {
    basis: "express-written" | "customer-initiated";
    capturedAt: string;
    evidenceReference: string;
  };
}

export interface OutboundMessageReceipt {
  provider: string;
  providerMessageId: string;
  acceptedAt: string;
  providerStatus: string;
}

export interface OutboundMessageGateway {
  send(request: OutboundMessageRequest): Promise<OutboundMessageReceipt>;
}

export class OutboundMessageValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super("Outbound message data is invalid.");
    this.name = "OutboundMessageValidationError";
    this.issues = [...issues];
  }
}

export function validateOutboundMessage(request: OutboundMessageRequest): void {
  const issues: string[] = [];
  if (!/^\+[1-9]\d{7,14}$/.test(request.to)) issues.push("to must use E.164 format.");
  if (!request.body.trim() || request.body.length > 1600) issues.push("body must contain 1 to 1600 characters.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (!request.consent.evidenceReference.trim()) issues.push("consent evidence is required.");
  if (Number.isNaN(new Date(request.consent.capturedAt).valueOf())) issues.push("consent.capturedAt is invalid.");
  if (issues.length) throw new OutboundMessageValidationError(issues);
}
