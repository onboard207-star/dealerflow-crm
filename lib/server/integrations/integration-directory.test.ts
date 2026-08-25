import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { IntegrationDirectoryReader } from "./integration-directory";

describe("IntegrationDirectoryReader", () => {
  it("returns masked metadata limited to the membership location grant", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({}).mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: "int_twilio1", location_id: "loc_main",
        location_name: "Main Store", account_suffix: "1234", public_base_url: "https://crm.example.com",
        default_from_address: "+12075550199", active: true, updated_at: new Date("2026-08-24T12:00:00Z") }] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };
    const result = await new IntegrationDirectoryReader(pool).listTwilio({ userId: "usr_admin01",
      organizationId: "org_dealerflow", locationIds: ["loc_main"] });
    expect(result).toEqual([{ id: "int_twilio1", locationId: "loc_main", locationName: "Main Store",
      accountSuffix: "1234", publicBaseUrl: "https://crm.example.com", defaultFromAddress: "+12075550199",
      active: true, updatedAt: "2026-08-24T12:00:00.000Z" }]);
    expect(query.mock.calls[2]?.[1]).toEqual(["org_dealerflow", false, ["loc_main"]]);
    expect(String(query.mock.calls[2]?.[0])).not.toContain("credential_reference");
    expect(String(query.mock.calls[2]?.[0])).not.toContain("webhook_key_hash");
  });
});
