import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateVerticalExpansion } from "./validate-vertical-expansion.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const manifest = await read("vertical-expansion-manifest.json");
const registry = await read("industry-pack-registry.json");

describe("vertical expansion controls", () => {
  it("accepts the truthful automotive-first posture", () => {
    const result = validateVerticalExpansion(manifest, registry);
    expect(result.valid).toBe(true);
    expect(result.blockers).toContain("automotivePilotPassed");
  });

  it("rejects treating terminology as schema authority", () => {
    const result = validateVerticalExpansion({
      ...manifest,
      boundaries: { ...manifest.boundaries, terminologyCreatesSchemaAuthority: true },
    }, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("terminologyCreatesSchemaAuthority must remain false");
  });

  it("rejects premature non-automotive maturity", () => {
    const changed = {
      ...registry,
      packs: registry.packs.map((pack) => pack.id === "marine" ? { ...pack, status: "synthetic" } : pack),
    };
    const result = validateVerticalExpansion(manifest, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("marine must remain Concept until vertical expansion is authorized");
  });

  it("rejects commercial activation of a concept pack", () => {
    const changed = {
      ...registry,
      packs: registry.packs.map((pack) => pack.id === "powersports" ? { ...pack, commerciallyEnabled: true } : pack),
    };
    const result = validateVerticalExpansion(manifest, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("powersports cannot be commercially enabled");
  });

  it("requires automotive to remain the reference implementation", () => {
    const changed = { ...registry, packs: registry.packs.map((pack) => ({ ...pack, referenceImplementation: false })) };
    const result = validateVerticalExpansion(manifest, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Automotive must be the single reference implementation");
  });
});
