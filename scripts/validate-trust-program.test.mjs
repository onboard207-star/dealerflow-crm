import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateTrustProgram } from "./validate-trust-program.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const controls = await read("trust-control-registry.json");
const evidence = await read("trust-evidence-registry.json");

describe("enterprise trust program", () => {
  it("accepts the truthful tested-versus-missing evidence split", () => {
    const result = validateTrustProgram(controls, evidence);
    expect(result.valid).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining(["DF-BCP-001", "DF-BCP-002", "DF-OPS-001", "DF-IAM-001", "DF-ASR-001"]));
  });

  it("rejects certification claims without independent evidence", () => {
    const result = validateTrustProgram({ ...controls, certifications: { ...controls.certifications, soc2: true } }, evidence);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("soc2 must remain false without authorized independent evidence");
  });

  it("rejects stale evidence represented as current", () => {
    const changed = {
      ...evidence,
      evidence: evidence.evidence.map((item, index) => index === 0 ? { ...item, verifiedAt: "2025-01-01" } : item),
    };
    const result = validateTrustProgram(controls, changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("EVD-TENANT-001 is expired and cannot remain current");
  });

  it("rejects tested status backed only by missing evidence", () => {
    const changed = {
      ...controls,
      controls: controls.controls.map((control) => control.id === "DF-BCP-002" ? { ...control, status: "tested" } : control),
    };
    const result = validateTrustProgram(changed, evidence);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("DF-BCP-002 cannot be tested without current evidence");
  });

  it("rejects unsupported compliance prose", () => {
    const changed = {
      ...controls,
      controls: controls.controls.map((control, index) => index === 0 ? { ...control, customerSafeStatement: "DealerFlow is SOC 2 compliant." } : control),
    };
    const result = validateTrustProgram(changed, evidence);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("DF-SEC-001 contains an unsupported certification/compliance claim");
  });
});
