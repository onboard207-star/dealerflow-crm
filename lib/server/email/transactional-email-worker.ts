import type { Pool, PoolClient } from "pg";
import type { TransactionalEmailGateway, TransactionalEmailMessage } from "@/lib/application/email";
import { TransactionalEmailDeliveryError } from "./resend-gateway";

interface ClaimedEmail extends TransactionalEmailMessage { id: string; attemptCount: number }
export interface TransactionalEmailWorkerResult { claimed: number; sent: number; failed: number }

export class TransactionalEmailWorker {
  constructor(private readonly pool: Pool, private readonly gateway: TransactionalEmailGateway) {}

  async run(limit: number): Promise<TransactionalEmailWorkerResult> {
    const messages = await this.claim(limit);
    let sent = 0;
    let failed = 0;
    for (const message of messages) {
      try {
        const outcome = await this.gateway.send(message);
        await this.pool.query(`UPDATE transactional_email_messages SET status='sent', provider_message_id=$2, sent_at=now(), updated_at=now(), last_error_code=null WHERE id=$1 AND status='sending'`, [message.id, outcome.providerMessageId]);
        sent += 1;
      } catch (error) {
        const code = error instanceof TransactionalEmailDeliveryError ? error.code : "provider-unavailable";
        const terminal = message.attemptCount >= 5;
        await this.pool.query(`UPDATE transactional_email_messages SET status=$2, last_error_code=$3, not_before=now() + ($4 * interval '1 minute'), updated_at=now() WHERE id=$1 AND status='sending'`, [message.id, terminal ? "failed" : "queued", code, Math.min(2 ** message.attemptCount, 60)]);
        failed += 1;
      }
    }
    return { claimed: messages.length, sent, failed };
  }

  private async claim(limit: number): Promise<ClaimedEmail[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await claimRows(client, limit);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}

async function claimRows(client: PoolClient, limit: number): Promise<ClaimedEmail[]> {
  const result = await client.query<{ id: string; kind: TransactionalEmailMessage["kind"]; recipient_email: string; subject: string; text_body: string; html_body: string; idempotency_key: string; attempt_count: number }>(
    `WITH due AS (SELECT id FROM transactional_email_messages WHERE attempt_count<10 AND ((status='queued' AND not_before <= now()) OR (status='sending' AND updated_at<now()-interval '10 minutes')) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1)
     UPDATE transactional_email_messages m SET status='sending', attempt_count=attempt_count+1, updated_at=now() FROM due WHERE m.id=due.id
     RETURNING m.id,m.kind,m.recipient_email,m.subject,m.text_body,m.html_body,m.idempotency_key,m.attempt_count`, [limit]);
  return result.rows.map((row) => ({ id: row.id, kind: row.kind, recipientEmail: row.recipient_email, subject: row.subject, textBody: row.text_body, htmlBody: row.html_body, idempotencyKey: row.idempotency_key, attemptCount: row.attempt_count }));
}
