import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validatePilotCutoverManifest } from "./validate-pilot-cutover.mjs";

const manifest = JSON.parse(
  await readFile(new URL("../config/pilot-launch-manifest.json", import.meta.url), "utf8"),
);

describe("pilot cutover manifest", () => {
  it("accepts the truthful current NO-GO posture", () => {
    const result = validatePilotCutoverManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("rejects GO when a prerequisite remains open", () => {
    const result = validatePilotCutoverManifest({ ...manifest, decision: "GO" });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("prerequisite gates remain open");
  });

  it("rejects silent activation of a risky feature", () => {
    const result = validatePilotCutoverManifest({
      ...manifest,
      featurePosture: { ...manifest.featurePosture, autonomousCustomerSends: true },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "autonomousCustomerSends must remain disabled until separately approved",
    );
  });
});
