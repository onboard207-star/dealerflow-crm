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
    expect(source).toContain("Obsolete after Deal delivery.");
    expect(source).toContain("task_status_events");
  });

  it("expires only non-authoritative draft or presented Trade appraisals when their Deal is delivered", () => {
    const source = readFileSync(new URL("./postgres-deal-provider.ts", import.meta.url), "utf8");

    expect(source).toContain("appraisal.organization_id=$1 AND appraisal.deal_id=$2");
    expect(source).toContain("appraisal.status IN ('draft','presented')");
    expect(source).toContain("terms.trade_appraisal_id=appraisal.id");
    expect(source).toContain("quote.status='accepted'");
    expect(source).toContain("SET status='expired'");
  });

  it("preserves Trade financial evidence and records immutable terminal history", () => {
    const source = readFileSync(new URL("./postgres-deal-provider.ts", import.meta.url), "utf8");
    const reconciliation = source.slice(source.indexOf("const unusedTradeAppraisals"), source.indexOf("await this.db.query(`UPDATE lead_vehicle_interests"));

    expect(reconciliation).not.toContain("allowance_cents=");
    expect(reconciliation).not.toContain("payoff_cents=");
    expect(reconciliation).not.toContain("equity_cents=");
    expect(reconciliation).toContain("trade_appraisal_status_events");
    expect(reconciliation).toContain("deal-delivered:${record.id}:trade:${appraisal.id}");
    expect(reconciliation).toContain("trade_appraisal.status_changed");
  });

  it("keeps delivery reconciliation tenant-scoped, replay-safe, and isolated from Deal, Vehicle, and Quote values", () => {
    const source = readFileSync(new URL("./postgres-deal-provider.ts", import.meta.url), "utf8");
    const reconciliation = source.slice(source.indexOf("const unusedTradeAppraisals"), source.indexOf("await this.db.query(`UPDATE lead_vehicle_interests"));

    expect(reconciliation).toContain("appraisal.organization_id=$1");
    expect(reconciliation).toContain("quote.organization_id=appraisal.organization_id");
    expect(reconciliation).toContain("AND appraisal.status=current.status");
    expect(reconciliation).not.toContain("UPDATE deals");
    expect(reconciliation).not.toContain("UPDATE vehicles");
    expect(reconciliation).not.toContain("UPDATE inventory_units");
    expect(reconciliation).not.toContain("UPDATE deal_quotes");
  });
});
