import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { PostgresOutboundMessagingProvider } from "./postgres-outbound-messaging";

describe("PostgresOutboundMessagingProvider location boundaries", () => {
  it("binds address matching and send eligibility to the requested location", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({}).mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ matches: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
    const provider = new PostgresOutboundMessagingProvider(pool as unknown as Pool, { userId: "usr_salesperson", organizationId: "org_dealerflow" });
    await provider.transaction(async (session) => {
      await session.customerAddressMatches({ organizationId: "org_dealerflow", locationId: "loc_main" }, "cus_jordan", "sms", "+12075550123");
      await session.resolveEligibility({ organizationId: "org_dealerflow", locationId: "loc_main" }, "cus_jordan", "int_twilio", "+12075550123", "operational", "led_jordan");
    });
    expect(query.mock.calls[2]?.[0]).toContain("location_id=$4");
    expect(query.mock.calls[2]?.[1]).toEqual(["org_dealerflow", "cus_jordan", "+12075550123", "loc_main"]);
    expect(query.mock.calls[3]?.[0]).toContain("customer.location_id = $7");
    expect(query.mock.calls[3]?.[1]).toEqual(["org_dealerflow", "cus_jordan", "int_twilio", "+12075550123", "operational", "led_jordan", "loc_main"]);
  });
});
