import type { Pool } from "pg";

export interface TransactionalEmailOperationsSnapshot {
  counts: { queued: number; sending: number; sent: number; failed: number };
  oldestQueuedSeconds: number | null;
  recentFailureCodes: readonly { code: string; count: number }[];
}

export class TransactionalEmailOperationsReader {
  constructor(private readonly pool: Pool) {}
  async snapshot(): Promise<TransactionalEmailOperationsSnapshot> {
    const [counts, failures] = await Promise.all([
      this.pool.query<{ queued:number; sending:number; sent:number; failed:number; oldest_queued_seconds:number|null }>(`SELECT count(*) FILTER(WHERE status='queued')::int queued,count(*) FILTER(WHERE status='sending')::int sending,count(*) FILTER(WHERE status='sent')::int sent,count(*) FILTER(WHERE status='failed')::int failed,extract(epoch FROM now()-min(created_at) FILTER(WHERE status='queued'))::int oldest_queued_seconds FROM transactional_email_messages WHERE created_at>now()-interval '7 days'`),
      this.pool.query<{ code:string; count:number }>(`SELECT COALESCE(last_error_code,'unknown') code,count(*)::int count FROM transactional_email_messages WHERE status='failed' AND updated_at>now()-interval '7 days' GROUP BY last_error_code ORDER BY count(*) DESC LIMIT 10`),
    ]);
    const row=counts.rows[0]??{queued:0,sending:0,sent:0,failed:0,oldest_queued_seconds:null};
    return { counts:{queued:row.queued,sending:row.sending,sent:row.sent,failed:row.failed},oldestQueuedSeconds:row.oldest_queued_seconds,recentFailureCodes:failures.rows };
  }
}
