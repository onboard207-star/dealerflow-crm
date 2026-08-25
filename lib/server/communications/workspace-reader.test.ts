import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { CommunicationWorkspaceReader } from "./workspace-reader";

describe("CommunicationWorkspaceReader", () => {
  it("resolves integration and consent only for the exact dealership location and address", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({}).mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: "int_twilio" }] })
      .mockResolvedValueOnce({ rows: [{ action: "granted", basis: "customer-initiated", evidence_reference: "Inbound SMS", occurred_at: new Date("2026-08-24T12:00:00Z") }] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
    const result = await new CommunicationWorkspaceReader(pool).read({ userId: "usr_salesperson", organizationId: "org_dealerflow", locationId: "loc_main", customerId: "cus_jordan", phone: "+12075550123" });
    expect(result).toMatchObject({ integrationId: "int_twilio", consent: { action: "granted" } });
    expect(query.mock.calls[2]?.[1]).toEqual(["org_dealerflow", "loc_main"]);
    expect(query.mock.calls[3]?.[1]).toEqual(["org_dealerflow", "cus_jordan", "loc_main", "+12075550123"]);
  });
});
