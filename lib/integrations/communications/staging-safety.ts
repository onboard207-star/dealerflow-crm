import type { OutboundMessageGateway, OutboundMessageReceipt, OutboundMessageRequest } from "./outbound-gateway";

export class StagingCommunicationSafetyError extends Error {
  constructor(readonly code: "configuration-unavailable" | "destination-blocked" | "sender-blocked" | "tenant-blocked") {
    super("The staging communication safety envelope rejected this operation.");
    this.name = "StagingCommunicationSafetyError";
  }
}

export function parseStagingDestinationAllowlist(value: string | undefined, kind: "email" | "sms"): ReadonlySet<string> {
  const values = (value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (values.length === 0) throw new StagingCommunicationSafetyError("configuration-unavailable");
  const valid = kind === "sms"
    ? values.every((item) => /^\+[1-9]\d{7,14}$/.test(item))
    : values.every((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item));
  if (!valid) throw new StagingCommunicationSafetyError("configuration-unavailable");
  return new Set(values);
}

export function assertStagingSenderAllowed(sender: string, allowlist: ReadonlySet<string>): void {
  const mailbox = sender.match(/^(?:[^<>]+\s+<)?([^<>\s]+@[^<>\s]+)>?$/)?.[1] ?? sender;
  if (!allowlist.has(mailbox.trim().toLowerCase())) throw new StagingCommunicationSafetyError("sender-blocked");
}

export function assertStagingDemoTenant(dataClass: string): void {
  if (dataClass !== "demo") throw new StagingCommunicationSafetyError("tenant-blocked");
}

export class StagingRestrictedMessageGateway implements OutboundMessageGateway {
  constructor(private readonly delegate: OutboundMessageGateway, private readonly recipients: ReadonlySet<string>) {}
  async send(request: OutboundMessageRequest): Promise<OutboundMessageReceipt> {
    if (!this.recipients.has(request.to.toLowerCase())) throw new StagingCommunicationSafetyError("destination-blocked");
    return this.delegate.send(request);
  }
}
