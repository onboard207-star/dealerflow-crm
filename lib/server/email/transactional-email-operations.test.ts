import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { TransactionalEmailOperationsReader } from "./transactional-email-operations";

describe("TransactionalEmailOperationsReader", () => {
  it("returns bounded operational counts and sanitized failure codes", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ queued: 3, sending: 1, sent: 9, failed: 2, oldest_queued_seconds: 420 }] })
      .mockResolvedValueOnce({ rows: [{ code: "staging-recipient-blocked", count: 2 }] });
    const result = await new TransactionalEmailOperationsReader({ query } as unknown as Pool).snapshot();
    expect(result).toEqual({ counts: { queued: 3, sending: 1, sent: 9, failed: 2 }, oldestQueuedSeconds: 420, recentFailureCodes: [{ code: "staging-recipient-blocked", count: 2 }] });
    expect(query.mock.calls[0]?.[0]).toContain("interval '7 days'");
    expect(query.mock.calls[1]?.[0]).toContain("LIMIT 10");
  });

  it("normalizes an empty aggregate result", async () => {
    const pool = { query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }) } as unknown as Pool;
    await expect(new TransactionalEmailOperationsReader(pool).snapshot()).resolves.toEqual({ counts: { queued: 0, sending: 0, sent: 0, failed: 0 }, oldestQueuedSeconds: null, recentFailureCodes: [] });
  });
});
