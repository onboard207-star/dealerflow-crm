import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { TransactionalEmailGateway } from "@/lib/application/email";
import { TransactionalEmailDeliveryError } from "./resend-gateway";
import { TransactionalEmailWorker } from "./transactional-email-worker";

const row = (attemptCount = 1) => ({ id: "tem_test001", kind: "password-reset", recipient_email: "recipient@example.com", subject: "Reset", text_body: "Reset", html_body: "<p>Reset</p>", idempotency_key: "reset-1", attempt_count: attemptCount });
function fixture(message = row()) {
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    void values;
    return sql.includes("RETURNING m.id") ? { rows: [message] } : { rows: [] };
  });
  const client = { query, release: vi.fn() };
  return { pool: { connect: vi.fn().mockResolvedValue(client), query } as unknown as Pool, query, client };
}

describe("TransactionalEmailWorker", () => {
  it("claims with skip-locked recovery and records provider success", async () => {
    const { pool, query } = fixture();
    const send = vi.fn().mockResolvedValue({ providerMessageId: "provider-1" });
    const result = await new TransactionalEmailWorker(pool, { send } as TransactionalEmailGateway).run(5);
    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("FOR UPDATE SKIP LOCKED"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("status='sending'") && String(sql).includes("10 minutes"))).toBe(true);
    expect(query.mock.calls.some(([sql, values]) => String(sql).includes("provider_message_id") && values?.includes("provider-1"))).toBe(true);
  });

  it("requeues retryable failure with a sanitized code", async () => {
    const { pool, query } = fixture(row(2));
    const send = vi.fn().mockRejectedValue(new TransactionalEmailDeliveryError("provider-rejected"));
    const result = await new TransactionalEmailWorker(pool, { send } as TransactionalEmailGateway).run(5);
    expect(result.failed).toBe(1);
    expect(query.mock.calls.some(([, values]) => values?.includes("queued") && values?.includes("provider-rejected"))).toBe(true);
  });

  it("marks the fifth failed attempt terminal and rolls back a failed claim", async () => {
    const terminal = fixture(row(5));
    await new TransactionalEmailWorker(terminal.pool, { send: vi.fn().mockRejectedValue(new Error("secret provider response")) } as TransactionalEmailGateway).run(5);
    expect(terminal.query.mock.calls.some(([, values]) => values?.includes("failed") && values?.includes("provider-unavailable"))).toBe(true);
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => { void values; if (sql.includes("WITH due")) throw new Error("database unavailable"); return { rows: [] }; });
    const client = { query, release: vi.fn() };
    await expect(new TransactionalEmailWorker({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, { send: vi.fn() } as unknown as TransactionalEmailGateway).run(1)).rejects.toThrow("database unavailable");
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
