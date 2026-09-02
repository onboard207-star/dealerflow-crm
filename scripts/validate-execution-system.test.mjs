import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { reconcileExecutionSystem, renderDailyBuildBrief, renderEndOfDayHandoff, renderReleaseNotes, renderWeeklyViews, selectNextEligible } from "./validate-execution-system.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const readExecution = async (name) => JSON.parse(await readFile(new URL(`../dealerflow/execution/${name}`, import.meta.url), "utf8"));
const policy = await readExecution("execution-policy.json");
const work = await readExecution("EXECUTION_QUEUE.yaml");
const evidence = await readExecution("EVIDENCE/registry.json");
const releases = await readExecution("EVIDENCE/releases.json");
const governance = await readExecution("governance-registry.json");
const gateResolution = await readExecution("HUMAN_GATE_RESOLUTION.json");
const portfolio = await read("capability-implementation-registry.json");
const roadmap = await read("roadmap-outcome-registry.json");

const validate = (overrides = {}) => reconcileExecutionSystem(overrides.policy ?? policy, overrides.work ?? work, overrides.evidence ?? evidence, overrides.releases ?? releases, overrides.governance ?? governance, portfolio, roadmap);

describe("execution operating system", () => {
  it("keeps the staging gate packet machine-readable and production closed", () => {
    expect(gateResolution.schemaVersion).toBe(1);
    expect(gateResolution.productionGo).toBe(false);
    expect(gateResolution.observedPreflight.stopReason).toContain("Production");
    expect(gateResolution.decisions.find((gate) => gate.gateId === "HG-STG-001")?.recommendedDecision).toBe("NEEDS_HUMAN_DECISION");
    expect(gateResolution.decisions.find((gate) => gate.gateId === "HG-PROD-001")?.recommendedDecision).toBe("KEEP_CLOSED");
    expect(gateResolution.providerClassifications.some((provider) => provider.classification === "LIVE/PRODUCTION — DO NOT USE")).toBe(true);
  });
  it("accepts the pilot-first execution inventory and renders a resumable brief", () => {
    const result = validate();
    expect(result.valid).toBe(true);
    expect(result.prioritiesSummary).toEqual({P0: 0, P1: 6, P2: 0, P3: 1});
    expect(selectNextEligible(work)).toBeNull();
    expect(renderDailyBuildBrief(work, releases, governance, result)).toContain("No AUTO item is eligible");
    expect(renderEndOfDayHandoff(work, releases, governance, result)).toContain("Safe Stopping Point");
    expect(renderWeeklyViews(work, releases, governance, result, "executive")).toContain("Pilot readiness: NO_GO");
    expect(renderWeeklyViews(work, releases, governance, result, "engineering")).toContain("Open pull requests: 0");
    expect(renderWeeklyViews(work, releases, governance, result, "implementation")).toContain("no pilot cohort is authorized");
    expect(renderReleaseNotes(releases.releases.at(-1))).toContain("No customer release is authorized");
  });

  it("prevents Done when closure evidence is missing", () => {
    const changed = {...work, items: work.items.map((item) => item.id === "DWI-PILOT-002" ? {...item, state: "Done", runnerStatus: "COMPLETE", closureEvidence: []} : item)};
    const result = validate({work: changed});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("DWI-PILOT-002 Done requires closure evidence");
  });

  it("resumes provider work without creating a duplicate item once evidence arrives", () => {
    const accepted = evidence.evidence.map((item) => ["EVD-R2-001", "EVD-COMMS-001", "EVD-AI-PROVIDER-001"].includes(item.id) ? {...item, status: "current", commit: releases.releases[0].commit, releaseId: releases.releases[0].id, verifiedAt: evidence.asOf, source: "docs/operations/FIRST_PILOT_GO_LIVE.md"} : item);
    const changedEvidence = {...evidence, evidence: accepted};
    const changedWork = {...work, items: work.items.map((item) => item.id === "DWI-PILOT-003" ? {...item, state: "Verification", blocker: null, lastEvidenceAt: evidence.asOf} : item)};
    const result = validate({work: changedWork, evidence: changedEvidence});
    expect(result.valid).toBe(true);
    expect(changedWork.items.filter((item) => item.id === "DWI-PILOT-003")).toHaveLength(1);
  });

  it("blocks deployability when tenant-isolation verification fails", () => {
    const changed = {...releases, releases: releases.releases.map((release) => ({...release, gates: {...release.gates, tenantIsolation: {status: "blocked", evidenceIds: []}}}))};
    const result = validate({releases: changed});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("REL-CAND-20260901-001 cannot be deployable while tenantIsolation is not verified");
  });

  it("reopens stale release evidence instead of carrying it forward", () => {
    const changed = {...evidence, asOf: "2026-09-10"};
    const result = validate({evidence: changed});
    expect(result.valid).toBe(false);
    expect(result.staleEvidence).toEqual(expect.arrayContaining(["EVD-REPO-653F1DF", "EVD-IMPORT-TEST-001"]));
  });

  it("flags a hotfix that has not been reconciled to mainline", () => {
    const changed = {...releases, releases: releases.releases.map((release) => ({...release, hotfix: true, mainlineReconciled: false}))};
    const result = validate({releases: changed});
    expect(result.releaseBlockers["REL-CAND-20260901-001"]).toContain("mainlineReconciliation");
  });

  it("rejects duplicate work identity during batch reconciliation", () => {
    const duplicate = {...work.items[0]};
    const changed = {...work, items: [...work.items, duplicate]};
    const result = validate({work: changed});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("work item id is invalid or duplicated: DWI-PILOT-001");
  });
});
