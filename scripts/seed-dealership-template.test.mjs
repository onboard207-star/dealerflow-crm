import { describe, expect, it } from "vitest";
import template from "../config/dealership-template.json" with { type: "json" };
import systemRoles from "../config/system-roles.json" with { type: "json" };
import { assertGovernedFixtureVersion, buildTemplatePlan, deterministicId, parseArguments, seedDealershipTemplate, templateOwnedIds } from "./seed-dealership-template.mjs";

describe("dealership template seed", () => {
  const organizationId = "org_ae339ff94d8461ef4630e7aa1c320f28", locationId = "loc_ae339ff94d8461ef4630e7aa1c320f28";
  const resetOptions = { reset: true, governedFixtureVersion: "pilot-demo-v1" };

  it("requires an explicit organization", () => { expect(parseArguments(["--organization-id", organizationId])).toEqual({ organizationId }); expect(() => parseArguments([])).toThrow("organization-id"); expect(() => parseArguments(["--organization-id", "unsafe"])).toThrow("valid DealerFlow"); });

  it("builds a complete deterministic two-year synthetic lifecycle", () => { const first = buildTemplatePlan(organizationId, locationId), second=buildTemplatePlan(organizationId,locationId); expect(first).toEqual(second); expect(first.staff).toHaveLength(template.staff.length); expect(first.leads).toHaveLength(template.historicalMonths * template.monthlyLeadCount + template.currentOpenLeadCount); expect(first.deals).toHaveLength(template.historicalMonths * template.monthlySaleCount); expect(first.deliveries).toHaveLength(first.deals.length); expect(first.inventory).toHaveLength(first.deals.length + template.currentInventoryCount); expect(first.tasks).toHaveLength(template.currentOpenLeadCount); expect(new Set(first.staff.map(person => person.userId)).size).toBe(first.staff.length); expect(new Set(first.vehicles.map(vehicle=>vehicle.vin)).size).toBe(first.vehicles.length); expect(first.vehicles.every(vehicle=>vehicle.vin.startsWith("TEST"))).toBe(true); expect(first.customers.every(customer=>customer.email.endsWith(".invalid"))).toBe(true); expect(first.deals.every(deal => first.leads.some(lead => lead.id === deal.lead_id && lead.customer_id === deal.customer_id))).toBe(true); });

  it("maps every expected position to a configured permission role", () => { const roleKeys = new Set(systemRoles.map(role => role.key)); expect(template.staff.every(person => roleKeys.has(person.role))).toBe(true); expect(template.staff.some(person => person.position === "Dealer Principal")).toBe(true); expect(template.staff.filter(person => person.position === "Sales Consultant")).toHaveLength(8); expect(deterministicId("usr", "same")).toBe(deterministicId("usr", "same")); });

  it("derives the reset boundary only from deterministic template-owned records", () => {
    const plan = buildTemplatePlan(organizationId, locationId), owned = templateOwnedIds(plan);
    expect(owned.customers).toEqual(plan.customers.map((record) => record.id));
    expect(owned.leads).toHaveLength(plan.leads.length);
    expect(owned.inventory).toHaveLength(plan.inventory.length);
    expect(Object.values(owned).flat().every((id) => typeof id === "string" && id.includes("_"))).toBe(true);
    expect(owned).not.toHaveProperty("staff");
  });

  it("resets and reseeds in one transaction with demo classification locked", async () => {
    const statements = [], calls = [];
    const client = { query: async (sql, values) => { statements.push(sql); calls.push({ sql, values }); if (sql.includes("FROM organizations")) return { rows: [{ id: organizationId }] }; if (sql.includes("FROM audit_logs")) return { rows: [{ id: "aud_existing" }] }; if (sql.includes("FROM locations")) return { rows: [{ id: locationId }] }; if (sql.startsWith("DELETE FROM ")) return { rows: values[1].map((id) => ({ id })) }; return { rows: [] }; }, release: () => {} };
    const result = await seedDealershipTemplate({ connect: async () => client }, organizationId, resetOptions);
    expect(result.reset).toBe(true);
    expect(result.resetAuditId).toMatch(/^aud_[a-f0-9]{32}$/);
    expect(statements[0]).toBe("BEGIN");
    expect(statements.some((sql) => sql.includes("data_class='demo' FOR UPDATE"))).toBe(true);
    expect(statements.filter((sql) => sql.startsWith("SELECT id FROM ") && !sql.includes("organizations") && !sql.includes("audit_logs") && !sql.includes("locations"))).toHaveLength(12);
    expect(statements.filter((sql) => sql.startsWith("DELETE FROM "))).toHaveLength(11);
    expect(statements.findIndex((sql) => sql.startsWith("DELETE FROM deal_deliveries"))).toBeLessThan(statements.findIndex((sql) => sql.startsWith("DELETE FROM deals")));
    expect(statements.findIndex((sql) => sql.startsWith("DELETE FROM deal_status_events"))).toBeLessThan(statements.findIndex((sql) => sql.startsWith("DELETE FROM deals")));
    expect(statements.some((sql) => sql.includes("app.synthetic_fixture_version"))).toBe(true);
    expect(calls.find(({ sql }) => sql.includes("app.synthetic_fixture_version")).values).toEqual(["pilot-demo-v1"]);
    expect(calls.find(({ sql }) => sql.includes("synthetic.reset_completed")).values[2]).toBe("synthetic-reset:pilot-demo-v1");
    expect(statements.some((sql) => sql.includes("synthetic.reset_completed"))).toBe(true);
    expect(statements.at(-1)).toBe("COMMIT");
  });

  it("fails closed before DELETE when governed fixture authorization is missing, malformed, or wrong", async () => {
    for (const governedFixtureVersion of [undefined, "pilot demo v1", "v1"]) {
      const statements = [];
      const client = { query: async (sql) => { statements.push(sql); if (sql.includes("FROM organizations")) return { rows: [{ id: organizationId }] }; if (sql.includes("FROM audit_logs")) return { rows: [{ id: "aud_existing" }] }; if (sql.includes("FROM locations")) return { rows: [{ id: locationId }] }; return { rows: [] }; }, release: () => {} };
      await expect(seedDealershipTemplate({ connect: async () => client }, organizationId, { reset: true, governedFixtureVersion })).rejects.toThrow("governed fixture version");
      expect(statements.some((sql) => sql.startsWith("DELETE FROM "))).toBe(false);
      expect(statements.at(-1)).toBe("ROLLBACK");
    }
    expect(assertGovernedFixtureVersion("pilot-demo-v1")).toBe("pilot-demo-v1");
    expect(() => assertGovernedFixtureVersion("v1")).toThrow("must match");
  });

  it("rolls back the entire reset when a dependency prevents deletion", async () => {
    const statements = [];
    const client = { query: async (sql, values) => { statements.push(sql); if (sql.includes("FROM organizations")) return { rows: [{ id: organizationId }] }; if (sql.includes("FROM audit_logs")) return { rows: [{ id: "aud_existing" }] }; if (sql.includes("FROM locations")) return { rows: [{ id: locationId }] }; if (sql.startsWith("DELETE FROM deals")) throw new Error("dependent record"); if (sql.startsWith("DELETE FROM ")) return { rows: values[1].map((id) => ({ id })) }; return { rows: [] }; }, release: () => {} };
    await expect(seedDealershipTemplate({ connect: async () => client }, organizationId, resetOptions)).rejects.toThrow("dependent record");
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("fails closed and writes no completion event when RLS suppresses a fixture delete", async () => {
    const statements = [];
    const client = { query: async (sql, values) => { statements.push(sql); if (sql.includes("FROM organizations")) return { rows: [{ id: organizationId }] }; if (sql.includes("FROM audit_logs")) return { rows: [{ id: "aud_existing" }] }; if (sql.includes("FROM locations")) return { rows: [{ id: locationId }] }; if (sql.startsWith("DELETE FROM deal_deliveries")) return { rows: [] }; if (sql.startsWith("DELETE FROM ")) return { rows: values[1].map((id) => ({ id })) }; return { rows: [] }; }, release: () => {} };
    await expect(seedDealershipTemplate({ connect: async () => client }, organizationId, resetOptions)).rejects.toThrow("deleted 0 of");
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(statements.some((sql) => sql.includes("synthetic.reset_completed"))).toBe(false);
  });

  it("refuses a reset when the tenant contains non-fixture records", async () => {
    const statements = [];
    const client = { query: async (sql) => { statements.push(sql); if (sql.includes("FROM organizations")) return { rows: [{ id: organizationId }] }; if (sql.includes("FROM audit_logs")) return { rows: [{ id: "aud_existing" }] }; if (sql.includes("FROM locations")) return { rows: [{ id: locationId }] }; if (sql.startsWith("SELECT id FROM customers")) return { rows: [{ id: "cus_not_fixture_owned" }] }; return { rows: [] }; }, release: () => {} };
    await expect(seedDealershipTemplate({ connect: async () => client }, organizationId, resetOptions)).rejects.toThrow("outside fixture");
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(statements.some((sql) => sql.startsWith("DELETE FROM "))).toBe(false);
  });
});
