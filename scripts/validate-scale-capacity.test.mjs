import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateScaleCapacity } from "./validate-scale-capacity.mjs";

const manifest = JSON.parse(await readFile(new URL("../config/scale-capacity-manifest.json", import.meta.url), "utf8"));

describe("scale capacity controls", () => {
  it("accepts the truthful unknown-capacity NO-GO posture", () => {
    const result = validateScaleCapacity(manifest);
    expect(result.valid).toBe(true);
    expect(result.blockers25).toContain("measurement:active-rooftops");
    expect(result.blockers50).toContain("fiftyRooftopLoadPassed");
  });

  it("rejects invented values on an unknown measurement", () => {
    const changed = {
      ...manifest,
      measurements: manifest.measurements.map((item, index) => index === 0 ? { ...item, measuredCapacity: 50 } : item),
    };
    const result = validateScaleCapacity(changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("active-rooftops must not contain invented values while unknown");
  });

  it("rejects 25-rooftop GO with open evidence", () => {
    const result = validateScaleCapacity({
      ...manifest,
      recommendations: { ...manifest.recommendations, twentyFiveRooftops: "GO" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("25-rooftop GO is invalid");
  });

  it("rejects 50-rooftop GO before 25-rooftop GO", () => {
    const result = validateScaleCapacity({
      ...manifest,
      recommendations: { ...manifest.recommendations, fiftyRooftops: "GO" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("50-rooftop GO requires 25-rooftop GO");
  });
});
