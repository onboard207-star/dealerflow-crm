import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateCommercialLaunch } from "./validate-commercial-launch.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const manifest = await read("commercial-launch-manifest.json");
const maturity = await read("module-maturity-catalog.json");
const commercial = await read("commercial-capability-catalog.json");

describe("commercial launch controls", () => {
  it("accepts the truthful pre-commercial stop-sell posture", () => {
    const result = validateCommercialLaunch(manifest, maturity, commercial);
    expect(result.valid).toBe(true);
    expect(result.blockers).toContain("productizationDecision");
  });

  it("rejects broad selling before authorization", () => {
    const result = validateCommercialLaunch({
      ...manifest,
      activation: { ...manifest.activation, broadSellingEnabled: true },
    }, maturity, commercial);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("broad selling requires commercial authorization");
  });

  it("rejects selling a module that is not production-supported", () => {
    const changed = {
      ...commercial,
      capabilities: commercial.capabilities.map((item, index) => index === 0 ? { ...item, sellState: "sell" } : item),
    };
    const result = validateCommercialLaunch(manifest, maturity, changed);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("cannot be sellable at maturity pilot");
  });

  it("rejects omission of a product module from commercial scope", () => {
    const result = validateCommercialLaunch(manifest, maturity, {
      ...commercial,
      capabilities: commercial.capabilities.slice(1),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("crm is missing from the commercial capability catalog");
  });
});
