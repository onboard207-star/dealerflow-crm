import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PostgresDealProvider", () => {
  it("casts the Deal-controlled inventory status parameter consistently", () => {
    const source = readFileSync(new URL("./postgres-deal-provider.ts", import.meta.url), "utf8");

    expect(source).toContain("status = $3::inventory_status");
    expect(source).toContain("$3::inventory_status = 'sold'::inventory_status");
    expect(source).toContain("'purchased'::vehicle_interest_status");
    expect(source).toContain("'inactive'::vehicle_interest_status");
    expect(source).toContain("visit.appointment_id=$8");
    expect(source).toContain("JOIN membership_locations");
    expect(source).toContain("accepted_quote_version");
    expect(source).toContain("q.version=d.accepted_quote_version");
    expect(source).toContain("deal_document_requirements");
    expect(source).toContain("'canonical-quote','complete'");
  });
});
