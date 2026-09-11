import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  DemoRequestConflictError,
  DemoRequestIntake,
  DemoRequestValidationError,
} from "./demo-request-intake";

const request = {
  firstName: "Jamie",
  lastName: "Rivera",
  email: "jamie@synthetic-dealer.example",
  dealership: "DealerFlow Synthetic Clean Room",
  role: "Sales Manager",
  rooftops: "1",
  interest: "Connected customer workflow",
  contact: "Email",
};

function poolWith(query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>) {
  const client = { query: vi.fn(query), release: vi.fn() };
  return { pool: { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, client };
}

describe("DemoRequestIntake", () => {
  it("stores the pre-tenant request, immutable evidence, and owner notification atomically", async () => {
    const { pool, client } = poolWith(async (sql) => {
      if (sql.includes("count(*) FILTER")) return { rows: [{ network_count: 0, email_count: 0 }] };
      return { rows: [] };
    });
    const result = await new DemoRequestIntake(pool, "s".repeat(32), "owner@example.com").submit(request, "192.0.2.1", "request-1");
    expect(result).toMatchObject({ created: true });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO commercial_demo_requests"))).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO transactional_email_messages"))).toBe(true);
    expect(client.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO commercial_demo_request_events"))).toHaveLength(2);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("reuses an exact request and refuses changed input under the same idempotency key", async () => {
    const fingerprint = "different";
    const { pool, client } = poolWith(async (sql) => sql.includes("SELECT id,idempotency_key")
      ? { rows: [{ id: "cdr_existing1", idempotency_key: "request-1", request_fingerprint: fingerprint }] }
      : { rows: [] });
    await expect(new DemoRequestIntake(pool, "s".repeat(32), "owner@example.com").submit(request, "192.0.2.1", "request-1"))
      .rejects.toBeInstanceOf(DemoRequestConflictError);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("rejects malformed and bot-filled submissions before database access", async () => {
    const connect = vi.fn();
    const intake = new DemoRequestIntake({ connect } as unknown as Pool, "s".repeat(32), "owner@example.com");
    await expect(intake.submit({ ...request, email: "invalid", website: "bot" }, "192.0.2.1", "request-1"))
      .rejects.toBeInstanceOf(DemoRequestValidationError);
    expect(connect).not.toHaveBeenCalled();
  });
});
