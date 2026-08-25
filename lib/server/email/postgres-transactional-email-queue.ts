import type { Pool } from "pg";
import type { TransactionalEmailMessage, TransactionalEmailQueue } from "@/lib/application/email";
import { generateEntityId } from "@/lib/core/identifiers";

export class PostgresTransactionalEmailQueue implements TransactionalEmailQueue {
  constructor(private readonly pool: Pool) {}

  async enqueue(message: TransactionalEmailMessage): Promise<void> {
    await this.pool.query(
      `INSERT INTO transactional_email_messages
        (id, kind, recipient_email, subject, text_body, html_body, idempotency_key)
       VALUES ($1,$2,lower($3),$4,$5,$6,$7)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [generateEntityId("tem"), message.kind, message.recipientEmail, message.subject, message.textBody, message.htmlBody, message.idempotencyKey],
    );
  }
}
