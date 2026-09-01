import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateDeveloperPlatform } from "./validate-developer-platform.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const manifest = await read("developer-platform-manifest.json");
const registry = await read("extension-surface-registry.json");

describe("developer platform controls", () => {
  it("accepts the truthful no-ecosystem posture", () => {
    const result = validateDeveloperPlatform(manifest, registry);
    expect(result.valid).toBe(true);
    expect(result.blockers).toContain("appIdentity");
  });

  it("rejects treating internal routes as public API", () => {
    const result = validateDeveloperPlatform({
      ...manifest,
      boundaries: { ...manifest.boundaries, internalRoutesArePublicApi: true },
    }, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("internalRoutesArePublicApi must remain false");
  });

  it("rejects enabling arbitrary extension code", () => {
    const result = validateDeveloperPlatform({
      ...manifest,
      activation: { ...manifest.activation, arbitraryExtensionCodeEnabled: true },
    }, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("arbitraryExtensionCodeEnabled must remain disabled");
  });

  it("rejects premature supported API classification", () => {
    const changed = {
      ...registry,
      surfaces: registry.surfaces.map((surface, index) => index === 0 ? { ...surface, classification: "supported-public" } : surface),
    };
    const result = validateDeveloperPlatform(manifest, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("organization-session-routes cannot be supported before developer-platform authorization");
  });

  it("rejects ecosystem GO without app authorities", () => {
    const result = validateDeveloperPlatform({
      ...manifest,
      recommendations: { ...manifest.recommendations, privateEcosystem: "GO" },
    }, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("ecosystem GO is invalid while developer authorities are absent");
  });
});
