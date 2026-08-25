import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { TwilioWebhookProcessor } from "./twilio-webhook-processor";

function harness(results: unknown[]) {
  const query = vi.fn<DatabaseClient["query"]>();
  for (const result of results) query.mockResolvedValueOnce(result);
  const client: DatabaseClient = { query, release: vi.fn() };
  const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
  return { pool, query };
}
const route = { integrationId: "int_twilio", organizationId: "org_dealerflow",
  credentialReference: "TWILIO_DEMO", publicBaseUrl: "https://crm.example.com" };

describe("TwilioWebhookProcessor", () => {
  it("persists the inbox event and a uniquely matched inbound customer message", async () => {
    const { pool, query } = harness([{}, {}, { rows: [{ id: "evt_1" }] },
      { rows: [{ id: "cus_1" }] }, {}, {}, {}, {}]);
    const result = await new TwilioWebhookProcessor(pool).process(route,
      { kind: "inbound-message", eventId: "SM1", accountSid: "AC1", from: "+12075550184",
        to: "+12075550199", body: "Interested", occurredAt: "2026-08-23T12:00:00.000Z" },
      { AccountSid: "AC1", MessageSid: "SM1" });
    expect(result).toBe("processed");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO integration_events"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO communications"))).toBe(true);
  });

  it("acknowledges replayed provider events without duplicate work", async () => {
    const { pool, query } = harness([{}, {}, { rows: [] }, {}, {}]);
    const result = await new TwilioWebhookProcessor(pool).process(route,
      { kind: "message-status", eventId: "SM1", accountSid: "AC1", status: "delivered", occurredAt: "2026-08-23T12:00:00.000Z" },
      { AccountSid: "AC1", MessageSid: "SM1" });
    expect(result).toBe("duplicate");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE communications"))).toBe(false);
  });

  it("reconciles canonical communication and durable send-attempt status", async () => {
    const { pool, query } = harness([{}, {}, { rows: [{ id: "evt_1" }] },
      { rows: [{ id: "com_1" }] }, { rows: [{ id: "snd_1" }] }, {}, {}, {}, {}]);
    const result = await new TwilioWebhookProcessor(pool).process(route,
      { kind: "message-status", eventId: "SM1", accountSid: "AC1", status: "delivered", occurredAt: "2026-08-23T12:00:00.000Z" },
      { AccountSid: "AC1", MessageSid: "SM1", MessageStatus: "delivered" });
    expect(result).toBe("processed");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE communications"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE communication_send_attempts"))).toBe(true);
  });
});
