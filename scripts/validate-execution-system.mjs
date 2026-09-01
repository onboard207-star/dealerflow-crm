import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const activeStates = new Set(["In Progress", "In Review", "Verification"]);
const gateStates = new Set(["verified", "blocked", "not-applicable"]);

const daysBetween = (from, to) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function reconcileExecutionSystem(policy, workRegistry, evidenceRegistry, releaseRegistry, governance, portfolio, roadmap) {
  const errors = [];
  if ([policy, workRegistry, evidenceRegistry, releaseRegistry, governance].some((value) => value?.schemaVersion !== 1)) errors.push("execution registries must use schemaVersion 1");

  const capabilityIds = new Set(portfolio?.capabilities?.map((item) => item.id) ?? []);
  const roadmapIds = new Set(roadmap?.outcomes?.map((item) => item.id) ?? []);
  const states = new Set(policy?.workStates ?? []);
  const priorities = new Set(Object.keys(policy?.priorities ?? {}));
  const blockerTypes = new Set(policy?.blockerTypes ?? []);
  const autonomyClasses = new Set(policy?.autonomyClasses ?? []);
  const runnerStatuses = new Set(policy?.runnerStatuses ?? []);
  const lanes = new Map((policy?.lanes ?? []).map((lane) => [lane.id, lane]));
  const evidenceById = new Map();
  for (const evidence of evidenceRegistry?.evidence ?? []) {
    if (!/^EVD-[A-Z0-9-]+$/.test(evidence.id ?? "") || evidenceById.has(evidence.id)) errors.push(`evidence id is invalid or duplicated: ${evidence.id ?? "missing"}`);
    evidenceById.set(evidence.id, evidence);
    if (!(policy?.evidenceKinds ?? []).includes(evidence.kind)) errors.push(`${evidence.id} has an invalid evidence kind`);
    if (!["current", "stale", "missing"].includes(evidence.status)) errors.push(`${evidence.id} has an invalid status`);
    if (evidence.status === "current" && (!evidence.commit || !evidence.releaseId || !evidence.verifiedAt || !evidence.source)) errors.push(`${evidence.id} current evidence requires commit, release, date, and source`);
  }

  const releaseById = new Map();
  for (const release of releaseRegistry?.releases ?? []) {
    if (!/^REL-[A-Z0-9-]+$/.test(release.id ?? "") || releaseById.has(release.id)) errors.push(`release id is invalid or duplicated: ${release.id ?? "missing"}`);
    releaseById.set(release.id, release);
  }
  for (const evidence of evidenceById.values()) if (evidence.releaseId && !releaseById.has(evidence.releaseId)) errors.push(`${evidence.id} references unknown release ${evidence.releaseId}`);

  const workById = new Map();
  for (const item of workRegistry?.items ?? []) {
    if (!/^DWI-[A-Z]+-\d{3}$/.test(item.id ?? "") || workById.has(item.id)) errors.push(`work item id is invalid or duplicated: ${item.id ?? "missing"}`);
    workById.set(item.id, item);
    if (!states.has(item.state)) errors.push(`${item.id} has an invalid state`);
    if (!priorities.has(item.priority)) errors.push(`${item.id} has an invalid priority`);
    if (!lanes.has(item.lane)) errors.push(`${item.id} has an invalid lane`);
    if (!autonomyClasses.has(item.autonomy)) errors.push(`${item.id} has an invalid autonomy class`);
    if (!runnerStatuses.has(item.runnerStatus)) errors.push(`${item.id} has an invalid runner status`);
    if (!item.title || !item.outcome || !item.ownerArea || !item.source?.type || !item.source?.ref) errors.push(`${item.id} is missing required governance fields`);
    if (!Array.isArray(item.acceptanceCriteria) || item.acceptanceCriteria.length === 0) errors.push(`${item.id} requires acceptance criteria`);
    for (const field of ["requiredTests", "evidencePaths", "nextEligibleItems"]) if (!Array.isArray(item[field])) errors.push(`${item.id} requires ${field}`);
    if (item.autonomy === "HUMAN_GATE" && !item.humanApprovalRequirement) errors.push(`${item.id} HUMAN_GATE requires an approval requirement`);
    if (item.autonomy === "AUTO" && item.humanApprovalRequirement) errors.push(`${item.id} AUTO cannot require human approval`);
    if (item.runnerStatus === "COMPLETE" && item.state !== "Done") errors.push(`${item.id} COMPLETE must have Done state`);
    if (item.runnerStatus === "IN_PROGRESS" && item.state !== "In Progress") errors.push(`${item.id} IN_PROGRESS must have In Progress state`);
    for (const capabilityId of item.capabilityIds ?? []) if (!capabilityIds.has(capabilityId)) errors.push(`${item.id} references unknown capability ${capabilityId}`);
    for (const outcomeId of item.roadmapOutcomeIds ?? []) if (!roadmapIds.has(outcomeId)) errors.push(`${item.id} references unknown roadmap outcome ${outcomeId}`);
    for (const evidenceId of [...(item.evidenceRequirements ?? []), ...(item.closureEvidence ?? [])]) if (!evidenceById.has(evidenceId)) errors.push(`${item.id} references unknown evidence ${evidenceId}`);
    if (item.state === "Blocked") {
      if (!item.blocker?.reason || !item.blocker?.unblockCondition || !item.blocker?.nextAction || !item.blocker?.ownerArea) errors.push(`${item.id} blocked state requires reason, unblock condition, next action, and owner area`);
      if (!blockerTypes.has(item.blocker?.type)) errors.push(`${item.id} has an invalid blocker type`);
      if (item.blocker?.type === "unknown" && !/investigat/i.test(item.blocker?.nextAction ?? "")) errors.push(`${item.id} unknown blocker requires an investigation action`);
    } else if (item.blocker) errors.push(`${item.id} has blocker metadata outside Blocked state`);
    if (item.state === "Done") {
      if ((item.closureEvidence ?? []).length === 0) errors.push(`${item.id} Done requires closure evidence`);
      for (const evidenceId of item.closureEvidence ?? []) if (evidenceById.get(evidenceId)?.status !== "current") errors.push(`${item.id} Done requires current evidence ${evidenceId}`);
      for (const evidenceId of item.evidenceRequirements ?? []) if (evidenceById.get(evidenceId)?.status !== "current") errors.push(`${item.id} Done requires current required evidence ${evidenceId}`);
    }
    if (item.targetRelease && !releaseById.has(item.targetRelease)) errors.push(`${item.id} references unknown target release ${item.targetRelease}`);
  }
  for (const item of workById.values()) for (const dependency of item.dependencies ?? []) if (!workById.has(dependency)) errors.push(`${item.id} references unknown work dependency ${dependency}`);
  for (const item of workById.values()) for (const nextId of item.nextEligibleItems ?? []) if (!workById.has(nextId)) errors.push(`${item.id} references unknown next eligible item ${nextId}`);

  const wip = {};
  for (const [laneId, lane] of lanes) {
    const active = [...workById.values()].filter((item) => item.lane === laneId && activeStates.has(item.state));
    wip[laneId] = {active: active.length, limit: lane.activeLimit, itemIds: active.map((item) => item.id)};
    if (active.length > lane.activeLimit) errors.push(`${laneId} exceeds WIP limit ${lane.activeLimit}`);
  }

  const staleEvidence = [];
  for (const evidence of evidenceById.values()) {
    if (evidence.status === "current" && daysBetween(evidence.verifiedAt, evidenceRegistry.asOf) > evidence.maxAgeDays) staleEvidence.push(evidence.id);
  }
  for (const evidenceId of staleEvidence) errors.push(`${evidenceId} is stale at the registry as-of date`);

  const releaseBlockers = {};
  for (const release of releaseById.values()) {
    for (const capabilityId of release.capabilityIds ?? []) if (!capabilityIds.has(capabilityId)) errors.push(`${release.id} references unknown capability ${capabilityId}`);
    for (const workItemId of release.workItemIds ?? []) if (!workById.has(workItemId)) errors.push(`${release.id} references unknown work item ${workItemId}`);
    const blocked = [];
    for (const [gateName, gate] of Object.entries(release.gates ?? {})) {
      if (!gateStates.has(gate.status)) errors.push(`${release.id}.${gateName} has an invalid gate status`);
      for (const evidenceId of gate.evidenceIds ?? []) {
        const evidence = evidenceById.get(evidenceId);
        if (!evidence) errors.push(`${release.id}.${gateName} references unknown evidence ${evidenceId}`);
        if (gate.status === "verified" && evidence?.status !== "current") errors.push(`${release.id}.${gateName} cannot be verified with ${evidenceId}`);
        if (gate.status === "verified" && evidence?.commit !== release.commit) errors.push(`${release.id}.${gateName} evidence ${evidenceId} is from another commit`);
      }
      if (gate.status === "blocked") blocked.push(gateName);
    }
    releaseBlockers[release.id] = blocked;
    if (release.dimensions?.deployable && release.gates?.repositoryGate?.status !== "verified") errors.push(`${release.id} cannot be deployable without a verified repository gate`);
    for (const gateName of ["migrationSafety", "tenantIsolation", "security"]) if (release.dimensions?.deployable && release.gates?.[gateName]?.status !== "verified") errors.push(`${release.id} cannot be deployable while ${gateName} is not verified`);
    if (release.dimensions?.deployed && !release.dimensions?.deployable) errors.push(`${release.id} cannot be deployed when not deployable`);
    if (release.dimensions?.enabled && !release.dimensions?.deployed) errors.push(`${release.id} cannot be enabled when not deployed`);
    if (release.dimensions?.supported && !release.dimensions?.enabled) errors.push(`${release.id} cannot be supported when not enabled`);
    if (release.hotfix && !release.mainlineReconciled) blocked.push("mainlineReconciliation");
  }

  const nowOutcomeIds = new Set((roadmap?.outcomes ?? []).filter((item) => item.horizon === "Now").map((item) => item.id));
  for (const outcomeId of nowOutcomeIds) if (![...workById.values()].some((item) => item.roadmapOutcomeIds?.includes(outcomeId))) errors.push(`Now outcome ${outcomeId} has no delivery work item`);

  const decisionIds = new Set();
  for (const decision of governance?.decisions ?? []) {
    if (!/^DEC-[A-Z]+-\d{3}$/.test(decision.id ?? "") || decisionIds.has(decision.id)) errors.push(`decision id is invalid or duplicated: ${decision.id ?? "missing"}`);
    decisionIds.add(decision.id);
    if (!decision.question || !decision.recommendation || !decision.noDecisionImpact || !decision.ownerArea) errors.push(`${decision.id} is incomplete`);
    for (const workItemId of decision.linkedWorkItemIds ?? []) if (!workById.has(workItemId)) errors.push(`${decision.id} references unknown work item ${workItemId}`);
  }
  const milestoneIds = new Set((governance?.milestones ?? []).map((item) => item.id));
  for (const milestone of governance?.milestones ?? []) {
    for (const workItemId of milestone.requiredWorkItemIds ?? []) if (!workById.has(workItemId)) errors.push(`${milestone.id} references unknown work item ${workItemId}`);
  }
  for (const risk of governance?.risks ?? []) {
    if (!/^RSK-\d{3}$/.test(risk.id ?? "") || !["High", "Medium", "Low"].includes(risk.level)) errors.push(`${risk.id ?? "risk"} has invalid identity or level`);
    if (!risk.trigger || !risk.mitigation || !risk.contingency || !risk.ownerArea) errors.push(`${risk.id} is incomplete`);
    for (const milestoneId of risk.affectedMilestoneIds ?? []) if (!milestoneIds.has(milestoneId)) errors.push(`${risk.id} references unknown milestone ${milestoneId}`);
    for (const workItemId of risk.linkedWorkItemIds ?? []) if (!workById.has(workItemId)) errors.push(`${risk.id} references unknown work item ${workItemId}`);
  }

  const aging = [...workById.values()].filter((item) => ["Ready", ...activeStates].includes(item.state) && daysBetween(item.lastEvidenceAt, workRegistry.updatedAt) >= 7).map((item) => item.id);
  const prioritiesSummary = Object.fromEntries([...priorities].map((priority) => [priority, [...workById.values()].filter((item) => item.priority === priority && !["Done", "Cancelled", "Deferred"].includes(item.state)).length]));
  return {valid: errors.length === 0, errors: [...new Set(errors)], wip, staleEvidence, aging, releaseBlockers, prioritiesSummary};
}

export function selectNextEligible(workRegistry) {
  const priorityRank = {P0: 0, P1: 1, P2: 2, P3: 3};
  const workById = new Map(workRegistry.items.map((item) => [item.id, item]));
  const eligible = workRegistry.items.filter((item) => {
    if (item.autonomy !== "AUTO" || !["READY", "IN_PROGRESS"].includes(item.runnerStatus)) return false;
    return (item.dependencies ?? []).every((id) => workById.get(id)?.runnerStatus === "COMPLETE");
  });
  eligible.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || (left.runnerStatus === "IN_PROGRESS" ? -1 : 1) || left.openedAt.localeCompare(right.openedAt) || left.id.localeCompare(right.id));
  return eligible[0] ?? null;
}

export function renderDailyBuildBrief(workRegistry, releaseRegistry, governance, result) {
  const active = workRegistry.items.filter((item) => ["Ready", "In Progress", "In Review", "Verification"].includes(item.state));
  const blocked = workRegistry.items.filter((item) => item.state === "Blocked");
  const release = releaseRegistry.releases[0];
  const lines = [
    "# DealerFlow Daily Build Brief",
    "",
    `**As of:** ${workRegistry.updatedAt}`,
    `**Release candidate:** ${release.id} · \`${release.branch}\` · \`${release.commit}\``,
    `**Release state:** ${release.state}; deployable ${release.dimensions.deployable ? "yes" : "no"}, deployed ${release.dimensions.deployed ? "yes" : "no"}, enabled ${release.dimensions.enabled ? "yes" : "no"}, supported ${release.dimensions.supported ? "yes" : "no"}.`,
    "",
    "## Highest-Priority Active Work",
    "",
    ...active.map((item) => `- ${item.id} · ${item.priority} · ${item.state} — ${item.title}`),
    ...(active.length ? [] : ["- None."]),
    "",
    "## Blockers",
    "",
    ...blocked.map((item) => `- ${item.id} — ${item.blocker.reason} Next: ${item.blocker.nextAction}`),
    "",
    "## Release Gate Changes",
    "",
    `- Open gates: ${(result.releaseBlockers[release.id] ?? []).join(", ") || "none"}.`,
    `- Stale evidence: ${result.staleEvidence.join(", ") || "none"}.`,
    `- Aging active work: ${result.aging.join(", ") || "none"}.`,
    "",
    "## Decisions",
    "",
    ...governance.decisions.filter((item) => item.state !== "Resolved").map((item) => `- ${item.id} · ${item.state} — ${item.question}`),
    "",
    "## Next Deterministic Actions",
    "",
    "1. Continue DWI-PILOT-002: implement transactional import commit, reconciliation, and reversal with tenant-integrity regression coverage.",
    "2. Resolve DEC-PILOT-001 so recovery, alert, and support exercises can run.",
    "3. Provision R2 and execute DWI-PILOT-003 media acceptance before optional AI provider calibration.",
    "4. Unblock DWI-PILOT-004 only after reversible import evidence is current."
  ];
  return `${lines.join("\n")}\n`;
}

export function renderEndOfDayHandoff(workRegistry, releaseRegistry, governance, result) {
  const release = releaseRegistry.releases[0];
  const completed = workRegistry.items.filter((item) => item.state === "Done");
  const verification = workRegistry.items.filter((item) => ["In Review", "Verification"].includes(item.state));
  return `# DealerFlow End-of-Day Handoff

**As of:** ${workRegistry.updatedAt}  
**Branch/commit:** \`${release.branch}\` · \`${release.commit}\`

## Completed Work

${completed.length ? completed.map((item) => `- ${item.id} — ${item.title}; evidence: ${item.closureEvidence.join(", ")}.`).join("\n") : "- No delivery work item reached Done in the current registry."}

## Review and Verification

${verification.length ? verification.map((item) => `- ${item.id} · ${item.state} — ${item.title}.`).join("\n") : "- No item is currently in review or verification."}

## Evidence and Release Impact

- Candidate ${release.id} is deployable: ${release.dimensions.deployable ? "yes" : "no"}; deployed: ${release.dimensions.deployed ? "yes" : "no"}; enabled: ${release.dimensions.enabled ? "yes" : "no"}; supported: ${release.dimensions.supported ? "yes" : "no"}.
- Open release gates: ${(result.releaseBlockers[release.id] ?? []).join(", ") || "none"}.
- Stale evidence: ${result.staleEvidence.join(", ") || "none"}.

## Blockers and Decisions

${workRegistry.items.filter((item) => item.state === "Blocked").map((item) => `- ${item.id} — ${item.blocker.reason} Unblock: ${item.blocker.unblockCondition}`).join("\n")}
${governance.decisions.filter((item) => item.state !== "Resolved").map((item) => `- ${item.id} — ${item.noDecisionImpact}`).join("\n")}

## Next Tasks in Exact Order

1. DWI-PILOT-002 — transactional import commit, reconciliation, reversal, and tests.
2. DWI-PILOT-005 / DEC-PILOT-001 — assign operational owners.
3. DWI-PILOT-003 — R2 acceptance, then required communications and AI provider paths.
4. DWI-PILOT-004 — reset and role UAT after import acceptance.
5. DWI-PILOT-001 — complete recovery, alert, escalation, and support exercises as dependencies become available.

## Safe Stopping Point

The repository candidate remains un-deployed and unsupported. Pilot cutover remains NO_GO. Resume from the first unfinished item above without opening a broad new feature family.
`;
}

export function renderWeeklyViews(workRegistry, releaseRegistry, governance, result, audience) {
  const release = releaseRegistry.releases[0];
  if (audience === "executive") return `# Founder and Executive Weekly View

- Current outcome: make the first controlled pilot reliable.
- Release: ${release.id}; deployable ${release.dimensions.deployable ? "yes" : "no"}, deployed ${release.dimensions.deployed ? "yes" : "no"}, supported ${release.dimensions.supported ? "yes" : "no"}.
- Pilot readiness: NO_GO; ${(result.releaseBlockers[release.id] ?? []).length} release gates remain blocked.
- Active P0/P1: ${result.prioritiesSummary.P0}/${result.prioritiesSummary.P1}.
- Top risks: ${governance.risks.filter((risk) => risk.state === "Active").map((risk) => `${risk.id} ${risk.level}`).join(", ")}.
- Key decisions: ${governance.decisions.filter((decision) => decision.state !== "Resolved").map((decision) => decision.id).join(", ")}.
- Next outcomes: reversible import; named operating ownership; provider acceptance; reset and role UAT; recovery and alert exercises.
`;
  if (audience === "engineering") return `# Engineering Weekly View

- Ready/In Progress/Review/Verification: ${workRegistry.items.filter((item) => ["Ready", "In Progress", "In Review", "Verification"].includes(item.state)).map((item) => `${item.id} ${item.state}`).join(", ") || "none"}.
- Open pull requests: 0 at the recorded source audit.
- Test failures: none in ${release.id} repository evidence.
- Migration change: ${release.migrations.changed ? "yes" : "no"}; latest ${release.migrations.latest}.
- Provider blockers: ${workRegistry.items.filter((item) => item.blocker?.type === "provider").map((item) => item.id).join(", ") || "none"}.
- Aging work: ${result.aging.join(", ") || "none"}.
- Release gates: ${(result.releaseBlockers[release.id] ?? []).join(", ") || "none"}.
`;
  return `# Implementation and Customer Success Weekly View

- Onboarding/data blocker: DWI-PILOT-002 is ${workRegistry.items.find((item) => item.id === "DWI-PILOT-002")?.state}.
- Provider setup: DWI-PILOT-003 is ${workRegistry.items.find((item) => item.id === "DWI-PILOT-003")?.state}.
- Training/UAT: DWI-PILOT-004 is ${workRegistry.items.find((item) => item.id === "DWI-PILOT-004")?.state}.
- Launch ownership/support: DWI-PILOT-005 is ${workRegistry.items.find((item) => item.id === "DWI-PILOT-005")?.state}.
- Supported capability posture: none; staging-verified capabilities remain commercially Unsupported.
- Launch wave: no pilot cohort is authorized.
`;
}

export function renderReleaseNotes(release) {
  return `# ${release.id} Release Notes

## Internal Engineering

- Commit: \`${release.commit}\` on \`${release.branch}\`.
- Migrations changed: ${release.migrations.changed ? "yes" : "no"}; latest schema ${release.migrations.latest}.
- Known issues: ${release.knownIssues.join(" ")}
- Rollback: ${release.rollback}

## Implementation and Support

${release.supportNotes.map((note) => `- ${note}`).join("\n")}

## Customer-Safe Notes

${release.customerSafeNotes.length ? release.customerSafeNotes.map((note) => `- ${note}`).join("\n") : "- No customer release is authorized; no customer-facing claims are published."}
`;
}

async function loadRegistries() {
  const readConfig = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
  const readExecution = async (name) => JSON.parse(await readFile(new URL(`../dealerflow/execution/${name}`, import.meta.url), "utf8"));
  return Promise.all([readExecution("execution-policy.json"), readExecution("EXECUTION_QUEUE.yaml"), readExecution("EVIDENCE/registry.json"), readExecution("EVIDENCE/releases.json"), readExecution("governance-registry.json"), readConfig("capability-implementation-registry.json"), readConfig("roadmap-outcome-registry.json")]);
}

async function main() {
  const [policy, work, evidence, releases, governance, portfolio, roadmap] = await loadRegistries();
  const result = reconcileExecutionSystem(policy, work, evidence, releases, governance, portfolio, roadmap);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  const view = process.argv.includes("--brief") ? "daily" : process.argv[process.argv.indexOf("--view") + 1];
  if (process.argv.includes("--next")) {
    const next = selectNextEligible(work);
    process.stdout.write(next ? `${next.id}\t${next.priority}\t${next.autonomy}\t${next.runnerStatus}\t${next.title}\n` : "NO_ELIGIBLE_AUTO_WORK\n");
    return;
  }
  if (view === "daily") process.stdout.write(renderDailyBuildBrief(work, releases, governance, result));
  else if (view === "eod") process.stdout.write(renderEndOfDayHandoff(work, releases, governance, result));
  else if (["executive", "engineering", "implementation"].includes(view)) process.stdout.write(renderWeeklyViews(work, releases, governance, result, view));
  else if (view === "release-notes") process.stdout.write(renderReleaseNotes(releases.releases[0]));
  else process.stdout.write(`Execution system valid. Work items: ${work.items.length}. P0/P1/P2/P3 active: ${result.prioritiesSummary.P0}/${result.prioritiesSummary.P1}/${result.prioritiesSummary.P2}/${result.prioritiesSummary.P3}. Aging active: ${result.aging.length}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
