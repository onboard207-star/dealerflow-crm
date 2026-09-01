import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateEnterpriseReadiness } from "./validate-enterprise-readiness.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const manifest = await read("enterprise-readiness-manifest.json");
const inheritance = await read("configuration-inheritance-registry.json");

describe("enterprise readiness controls", () => {
  it("accepts the truthful enterprise NO-GO posture", () => {
    const result = validateEnterpriseReadiness(manifest, inheritance);
    expect(result.valid).toBe(true);
    expect(result.blockers).toContain("fiftyRooftopGatePassed");
  });

  it("rejects implicit partner access", () => {
    const result = validateEnterpriseReadiness({
      ...manifest,
      existingBoundaries: { ...manifest.existingBoundaries, partnerHasImplicitCustomerAccess: true },
    }, inheritance);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("partners may not receive implicit customer access");
  });

  it("rejects activating an authority before its model exists", () => {
    const result = validateEnterpriseReadiness({
      ...manifest,
      authorities: { ...manifest.authorities, delegatedAdministration: true },
    }, inheritance);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("delegatedAdministration must remain disabled until its canonical authority exists");
  });

  it("rejects tenant override of platform security", () => {
    const changed = {
      ...inheritance,
      fields: inheritance.fields.map((field) => field.key === "tenantIsolation" ? { ...field, currentOverrideLayer: "organization" } : field),
    };
    const result = validateEnterpriseReadiness(manifest, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("tenantIsolation is a platform safety control and cannot be tenant-overridden");
  });

  it("rejects enterprise GO while lower-scale evidence remains open", () => {
    const result = validateEnterpriseReadiness({
      ...manifest,
      recommendations: { ...manifest.recommendations, oneHundredRooftops: "GO" },
    }, inheritance);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("oneHundredRooftops GO is invalid while enterprise evidence remains open");
  });
});
