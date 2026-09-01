import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { reconcileExecutionSystem, renderDailyBuildBrief, renderEndOfDayHandoff, renderReleaseNotes, renderWeeklyViews } from "./validate-execution-system.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const policy = await read("execution-policy.json");
const work = await read("delivery-work-registry.json");
const evidence = await read("delivery-evidence-registry.json");
const releases = await read("release-train-registry.json");
const governance = await read("execution-governance-registry.json");
const portfolio = await read("capability-implementation-registry.json");
const roadmap = await read("roadmap-outcome-registry.json");

const validate = (overrides = {}) => reconcileExecutionSystem(overrides.policy ?? policy, overrides.work ?? work, overrides.evidence ?? evidence, overrides.releases ?? releases, overrides.governance ?? governance, portfolio, roadmap);

describe("execution operating system", () => {
  it("accepts the pilot-first execution inventory and renders a resumable brief", () => {
    const result = validate();
    expect(result.valid).toBe(true);
    expect(result.prioritiesSummary).toEqual({P0: 0, P1: 5, P2: 0, P3: 1});
    expect(renderDailyBuildBrief(work, releases, governance, result)).toContain("DWI-PILOT-002");
    expect(renderEndOfDayHandoff(work, releases, governance, result)).toContain("Safe Stopping Point");
    expect(renderWeeklyViews(work, releases, governance, result, "executive")).toContain("Pilot readiness: NO_GO");
    expect(renderWeeklyViews(work, releases, governance, result, "engineering")).toContain("Open pull requests: 0");
    expect(renderWeeklyViews(work, releases, governance, result, "implementation")).toContain("no pilot cohort is authorized");
    expect(renderReleaseNotes(releases.releases[0])).toContain("No customer release is authorized");
  });

  it("prevents Done when required pilot evidence is missing", () => {
    const changed = {...work, items: work.items.map((item) => item.id === "DWI-PILOT-002" ? {...item, state: "Done", closureEvidence: ["EVD-IMPORT-TEST-001"]} : item)};
    const result = validate({work: changed});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("DWI-PILOT-002 Done requires current required evidence EVD-IMPORT-DRYRUN-001");
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
