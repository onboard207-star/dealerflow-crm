import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { CustomerRecommendationReader } from "./recommendation-reader";

describe("CustomerRecommendationReader", () => {
  it("reads the latest recommendation inside tenant context and validates its citations", async () => {
    const evidence = [{ id: "lead:stage", category: "engagement", observation: "Lead stage is contacted.", observedAt: "2026-08-24T12:00:00.000Z" }];
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{
        id: "air_latest01", status: "completed", evidence,
        output: { primaryAction: "Call the customer", rationale: "The lead needs follow-up.", evidenceIds: ["lead:stage"], confidence: 82, urgency: "high", timeHorizon: "Today", risks: [], opportunities: [], supportingActions: [] },
        refusal: null, review_decision: null,
        created_at: new Date("2026-08-24T12:00:00.000Z"), updated_at: new Date("2026-08-24T12:01:00.000Z"),
      }] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await new CustomerRecommendationReader(pool).latest("usr_sales01", "org_dealerflow", "cus_customer01");

    expect(result?.recommendation?.primaryAction).toBe("Call the customer");
    expect(query.mock.calls[2]?.[0]).toContain("organization_id = $1 AND customer_id = $2");
    expect(query.mock.calls[2]?.[1]).toEqual(["org_dealerflow", "cus_customer01"]);
  });

  it("rejects corrupt stored output rather than rendering untrusted guidance", async () => {
    const query = vi.fn<DatabaseClient["query"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{
        id: "air_latest01", status: "completed",
        evidence: [{ id: "known:evidence", category: "engagement", observation: "Known", observedAt: "2026-08-24T12:00:00.000Z" }],
        output: { primaryAction: "Call", rationale: "Reason", evidenceIds: ["invented:evidence"], confidence: 99, urgency: "high", timeHorizon: "Now", risks: [], opportunities: [], supportingActions: [] },
        refusal: null, review_decision: null,
        created_at: new Date(), updated_at: new Date(),
      }] })
      .mockResolvedValueOnce({});
    const client: DatabaseClient = { query, release: vi.fn() };
    const pool: DatabasePool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(new CustomerRecommendationReader(pool).latest("usr_sales01", "org_dealerflow", "cus_customer01")).rejects.toMatchObject({
      issues: ["Provider recommendation failed validation."],
    });
  });
});
