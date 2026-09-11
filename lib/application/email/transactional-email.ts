export type TransactionalEmailKind =
  | "email-verification"
  | "password-reset"
  | "organization-invitation"
  | "commercial-demo-request";

export interface TransactionalEmailMessage {
  kind: TransactionalEmailKind;
  recipientEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  idempotencyKey: string;
}

export interface TransactionalEmailGateway {
  send(message: TransactionalEmailMessage): Promise<{ providerMessageId: string }>;
}

export interface TransactionalEmailQueue {
  enqueue(message: TransactionalEmailMessage): Promise<void>;
}
