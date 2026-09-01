import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const prerequisites = [
  "automotivePilotPassed", "automotiveProductizationAuthorized",
  "repeatableAutomotiveRolloutPassed", "automotiveScaleEvidenceAccepted",
  "industryDemandValidated", "providerFeasibilityValidated",
  "supportReadinessValidated", "unitEconomicsValidated",
];
const activationKeys = [
  "packInstallationEnabled", "packUpgradeEnabled", "packCommercializationEnabled",
  "crossVerticalBenchmarkingEnabled", "tenantExecutableExtensionsEnabled", "multiPackGroupsEnabled",
];
const falseBoundaries = [
  "terminologyCreatesSchemaAuthority", "entitlementCreatesAuthorization",
  "genericVerticalEnumMeansSupported", "packMayBypassCoreSafety",
  "packMayExecuteArbitraryTenantCode", "crossTenantIdentityMergeEnabled",
];

export function validateVerticalExpansion(manifest, registry) {
  const errors = [];
  const blockers = [];
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (!['AUTHORIZED', 'NOT_AUTHORIZED'].includes(manifest?.decision)) errors.push("vertical expansion decision is invalid");
  for (const name of prerequisites) if (manifest?.prerequisites?.[name] !== true) blockers.push(name);
  for (const name of activationKeys) {
    if (manifest?.activation?.[name] !== false) errors.push(`${name} must remain disabled before vertical authorization`);
  }
  for (const name of falseBoundaries) {
    if (manifest?.boundaries?.[name] !== false) errors.push(`${name} must remain false`);
  }
  if (manifest?.boundaries?.automotiveRegressionMayBeSkipped !== false) errors.push("automotive regression may never be skipped");
  if (manifest?.decision === 'AUTHORIZED' && blockers.length > 0) errors.push(`vertical expansion is invalid while prerequisites remain open: ${blockers.join(', ')}`);

  if (registry?.schemaVersion !== 1 || !Array.isArray(registry?.packs)) errors.push("industry pack registry schema is invalid");
  const allowedStatuses = new Set(registry?.allowedStatuses ?? []);
  const ids = new Set();
  let references = 0;
  for (const pack of registry?.packs ?? []) {
    if (!pack.id || ids.has(pack.id)) errors.push(`pack ID is missing or duplicated: ${pack.id ?? 'unknown'}`);
    ids.add(pack.id);
    if (!allowedStatuses.has(pack.status)) errors.push(`${pack.id} has an invalid status`);
    if (!pack.evidence || !Array.isArray(pack.limitations) || pack.limitations.length === 0) errors.push(`${pack.id} requires evidence and limitations`);
    if (pack.referenceImplementation === true) references += 1;
    if (pack.id !== 'automotive' && pack.status !== 'concept') errors.push(`${pack.id} must remain Concept until vertical expansion is authorized`);
    if (pack.commerciallyEnabled !== false) errors.push(`${pack.id} cannot be commercially enabled`);
  }
  if (references !== 1 || registry?.packs?.find((pack) => pack.referenceImplementation)?.id !== 'automotive') errors.push("Automotive must be the single reference implementation");
  for (const required of ["automotive", "rv", "powersports", "marine"]) if (!ids.has(required)) errors.push(`missing required pack record: ${required}`);

  return { valid: errors.length === 0, errors, blockers };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../config/vertical-expansion-manifest.json", import.meta.url), "utf8"));
  const registry = JSON.parse(await readFile(new URL("../config/industry-pack-registry.json", import.meta.url), "utf8"));
  const result = validateVerticalExpansion(manifest, registry);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Vertical expansion controls valid. Decision: ${manifest.decision}. Open prerequisites: ${result.blockers.length}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
