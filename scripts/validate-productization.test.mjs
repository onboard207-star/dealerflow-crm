import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateProductization } from "./validate-productization.mjs";

const manifest = JSON.parse(await readFile(new URL("../config/productization-manifest.json", import.meta.url), "utf8"));
const catalog = JSON.parse(await readFile(new URL("../config/module-maturity-catalog.json", import.meta.url), "utf8"));

describe("productization controls", () => {
  it("accepts the truthful pre-pilot posture", () => {
    const result = validateProductization(manifest, catalog);
    expect(result.valid).toBe(true);
    expect(result.blockers).toContain("hypercareExit");
  });

  it("rejects authorization before evidence is complete", () => {
    const result = validateProductization({ ...manifest, decision: "AUTHORIZED" }, catalog);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("productization is invalid");
  });

  it("rejects cloning the pilot tenant", () => {
    const result = validateProductization({
      ...manifest,
      guardrails: { ...manifest.guardrails, clonePilotTenant: true },
    }, catalog);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("clonePilotTenant must remain false");
  });

  it("rejects unsupported production maturity claims", () => {
    const result = validateProductization(manifest, {
      ...catalog,
      modules: catalog.modules.map((module, index) => index === 0 ? { ...module, state: "production-supported" } : module),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("cannot be production-supported");
  });
});
