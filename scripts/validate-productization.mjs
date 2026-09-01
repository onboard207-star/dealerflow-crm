import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const prerequisiteNames = [
  "pilotFinalReport",
  "hypercareExit",
  "incidentReview",
  "supportCaseReview",
  "acceptanceMatrix",
  "trainingFeedback",
  "dataQualityReview",
  "providerHealthReview",
  "architectureReconciliation",
  "technicalDebtRegister",
];

const productizationEvidenceNames = [
  "baselineProfileApproved",
  "pilotLessonsClassified",
  "pilotHacksDispositioned",
  "freshTenantE2ePassed",
  "crossTenantE2ePassed",
  "upgradeE2ePassed",
  "rollbackE2ePassed",
];

const prohibitedGuardrails = [
  "clonePilotTenant",
  "copyPilotData",
  "promotePilotSpecificConfiguration",
  "enableRealBilling",
  "enableAutonomousCustomerCommunication",
  "inferProviderConfiguration",
  "allowAiGoApproval",
];

export function validateProductization(manifest, catalog) {
  const errors = [];
  const blockers = [];
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (!['AUTHORIZED', 'NOT_AUTHORIZED'].includes(manifest?.decision)) {
    errors.push("decision must be AUTHORIZED or NOT_AUTHORIZED");
  }

  for (const name of prerequisiteNames) {
    const item = manifest?.prerequisites?.[name];
    if (!item) {
      errors.push(`missing prerequisite: ${name}`);
      continue;
    }
    if (!['verified', 'partial', 'blocked', 'missing'].includes(item.status)) {
      errors.push(`${name} has an invalid status`);
    }
    if (item.status !== 'verified') blockers.push(name);
  }

  for (const name of productizationEvidenceNames) {
    if (manifest?.productization?.[name] !== true) blockers.push(name);
  }
  if (manifest?.productization?.secondDealerGoAuthorized === true && blockers.length > 0) {
    errors.push(`second-dealer GO is invalid while evidence remains open: ${blockers.join(', ')}`);
  }
  if (manifest?.decision === 'AUTHORIZED' && blockers.length > 0) {
    errors.push(`productization is invalid while evidence remains open: ${blockers.join(', ')}`);
  }
  for (const name of prohibitedGuardrails) {
    if (manifest?.guardrails?.[name] !== false) errors.push(`${name} must remain false`);
  }

  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog?.modules)) {
    errors.push("module catalog schema is invalid");
  } else {
    const keys = new Set();
    const allowedStates = new Set(catalog.allowedStates ?? []);
    for (const module of catalog.modules) {
      if (!module.key || keys.has(module.key)) errors.push(`module key is missing or duplicated: ${module.key ?? 'unknown'}`);
      keys.add(module.key);
      if (!allowedStates.has(module.state)) errors.push(`${module.key} has an invalid maturity state`);
      if (!module.evidence) errors.push(`${module.key} requires an evidence reference`);
      if (module.state === 'production-supported' && manifest?.decision !== 'AUTHORIZED') {
        errors.push(`${module.key} cannot be production-supported before productization authorization`);
      }
    }
  }

  return { valid: errors.length === 0, errors, blockers: [...new Set(blockers)] };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../config/productization-manifest.json", import.meta.url), "utf8"));
  const catalog = JSON.parse(await readFile(new URL("../config/module-maturity-catalog.json", import.meta.url), "utf8"));
  const result = validateProductization(manifest, catalog);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Productization controls valid. Decision: ${manifest.decision}. Open evidence: ${result.blockers.join(", ") || "none"}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
