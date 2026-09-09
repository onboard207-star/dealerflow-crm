import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("PostgresDealVehicleChangeProvider", () => {
  const source = readFileSync(new URL("./postgres-deal-vehicle-provider.ts", import.meta.url), "utf8");

  it("binds the target inventory and active primary interest to the exact governed Deal context", () => {
    expect(source).toContain("i.organization_id=d.organization_id");
    expect(source).toContain("i.location_id=d.location_id");
    expect(source).toContain("vi.customer_id=d.customer_id");
    expect(source).toContain("vi.lead_id=d.lead_id");
    expect(source).toContain("vi.role='primary'");
    expect(source).toContain("vi.status='active'");
    expect(source).toContain("i.status='available'");
  });

  it("refuses protected downstream progress and invalidates only draft Quotes", () => {
    expect(source).toContain("deal_quote_approvals");
    expect(source).toContain("q.status IN ('presented','accepted')");
    expect(source).toContain("deal_document_requirements");
    expect(source).toContain("deal_deliveries");
    expect(source).toContain("status='draft' FOR UPDATE");
    expect(source).toContain("Invalidated by Deal vehicle change.");
  });

  it("uses a compare-and-swap update before retaining immutable evidence and audit history", () => {
    expect(source).toContain("primary_vehicle_id=$7");
    expect(source).toContain("status IN ('draft','working')");
    expect(source).toContain("deal_vehicle_change_events");
    expect(source).toContain("deal.vehicle_changed");
  });
});
