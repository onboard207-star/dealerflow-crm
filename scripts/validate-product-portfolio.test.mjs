import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateProductPortfolio } from "./validate-product-portfolio.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const registry = await read("capability-implementation-registry.json");
const domainMap = await read("product-domain-map.json");
const roadmap = await read("roadmap-outcome-registry.json");

describe("product portfolio governance", () => {
  it("accepts the evidence-backed portfolio and pilot-first roadmap", () => {
    const result = validateProductPortfolio(registry, domainMap, roadmap);
    expect(result.valid).toBe(true);
    expect(result.maturityCounts["Pilot Ready"]).toBe(0);
    expect(result.maturityCounts.GA).toBe(0);
  });

  it("rejects staging maturity without staging evidence", () => {
    const changed = {
      ...registry,
      capabilities: registry.capabilities.map((capability) => capability.id === "CAP-CRM-001" ? {...capability, evidence: [{kind: "test", ref: "docs/BUILD_STATUS.md"}]} : capability),
    };
    const result = validateProductPortfolio(changed, domainMap, roadmap);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("CAP-CRM-001 requires staging evidence at Staging Verified");
  });

  it("rejects unsupported commercial promotion", () => {
    const changed = {
      ...registry,
      capabilities: registry.capabilities.map((capability) => capability.id === "CAP-AI-001" ? {...capability, commercialSupport: "Supported"} : capability),
    };
    const result = validateProductPortfolio(changed, domainMap, roadmap);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("CAP-AI-001 cannot be Supported at Code Complete");
  });

  it("rejects an unknown dependency", () => {
    const changed = {
      ...registry,
      capabilities: registry.capabilities.map((capability) => capability.id === "CAP-CRM-001" ? {...capability, hardDependencies: ["CAP-UNKNOWN-999"]} : capability),
    };
    const result = validateProductPortfolio(changed, domainMap, roadmap);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("CAP-CRM-001 references unknown dependency CAP-UNKNOWN-999");
  });

  it("rejects moving deferred platform work into Now", () => {
    const changed = {
      ...roadmap,
      outcomes: roadmap.outcomes.map((outcome) => outcome.id === "OUT-NOW-001" ? {...outcome, capabilityIds: [...outcome.capabilityIds, "CAP-EXT-001"]} : outcome),
    };
    const result = validateProductPortfolio(registry, domainMap, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Now roadmap improperly includes deferred capability CAP-EXT-001");
  });
});
