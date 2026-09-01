import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateFinancialOperatingSystem } from "./validate-financial-operating-system.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const manifest = await read("financial-operating-manifest.json");
const dictionary = await read("financial-metric-dictionary.json");

describe("financial operating controls", () => {
  it("accepts the truthful no-financial-authority posture", () => {
    const result = validateFinancialOperatingSystem(manifest, dictionary);
    expect(result.valid).toBe(true);
    expect(result.blockers).toContain("metric:mrr");
  });

  it("rejects treating retail Deal finance as company finance", () => {
    const result = validateFinancialOperatingSystem({
      ...manifest,
      boundaries: { ...manifest.boundaries, retailDealFinanceIsDealerFlowCompanyFinance: true },
    }, dictionary);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("retailDealFinanceIsDealerFlowCompanyFinance must remain false");
  });

  it("rejects an actual MRR metric without contract and subscription sources", () => {
    const changed = {
      ...dictionary,
      metrics: dictionary.metrics.map((metric) => metric.key === "mrr" ? { ...metric, availability: "available" } : metric),
    };
    const result = validateFinancialOperatingSystem(manifest, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("mrr cannot be available without sources: contracts, subscriptions");
  });

  it("rejects billing activation before finance authority", () => {
    const result = validateFinancialOperatingSystem({
      ...manifest,
      activation: { ...manifest.activation, billingEnabled: true },
    }, dictionary);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("billingEnabled must remain disabled");
  });

  it("rejects authorization while metrics remain unavailable", () => {
    const result = validateFinancialOperatingSystem({ ...manifest, decision: "AUTHORIZED" }, dictionary);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("financial operating authorization is invalid while sources and metrics remain unavailable");
  });
});
