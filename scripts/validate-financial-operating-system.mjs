import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const operationalAuthorityNames = [
  "commercialAccounts", "contracts", "subscriptions", "invoices", "collections",
  "providerCostLedger", "usageCostLedger", "implementationEffort", "supportEffort",
  "budgetVersions", "forecastVersions", "financePermissions",
];
const activationNames = [
  "actualFinancialMetricsEnabled", "forecastingEnabled", "billingEnabled",
  "manualAdjustmentsEnabled", "financeExportsEnabled", "aiFinanceAssistantEnabled",
];
const falseBoundaries = [
  "retailDealFinanceIsDealerFlowCompanyFinance", "productUsageIsBillableUsage",
  "bookingsAreCash", "pipelineIsRevenue", "implementationFeesAreArr",
  "estimatesAreActuals", "syntheticUsageIsProductionCost", "aiMayApproveFinancialActions",
];

export function validateFinancialOperatingSystem(manifest, dictionary) {
  const errors = [];
  const blockers = [];
  if (manifest?.schemaVersion !== 1 || dictionary?.schemaVersion !== 1) errors.push("financial registries must use schemaVersion 1");
  if (!['AUTHORIZED', 'NOT_AUTHORIZED'].includes(manifest?.decision)) errors.push("financial operating decision is invalid");

  for (const name of operationalAuthorityNames) {
    if (manifest?.operationalAuthorities?.[name] !== false) errors.push(`${name} must remain disabled until its authority is implemented`);
    blockers.push(name);
  }
  for (const name of activationNames) if (manifest?.activation?.[name] !== false) errors.push(`${name} must remain disabled`);
  for (const name of falseBoundaries) if (manifest?.boundaries?.[name] !== false) errors.push(`${name} must remain false`);

  const formalSources = manifest?.formalAuthority ?? {};
  const allowedClasses = new Set(dictionary?.allowedValueClasses ?? []);
  const keys = new Set();
  for (const metric of dictionary?.metrics ?? []) {
    if (!metric.key || keys.has(metric.key)) errors.push(`metric key is missing or duplicated: ${metric.key ?? 'unknown'}`);
    keys.add(metric.key);
    if (!['available', 'unavailable'].includes(metric.availability)) errors.push(`${metric.key} has an invalid availability`);
    if (!metric.formula || !metric.ownerRole || !Array.isArray(metric.requiredSources) || !Array.isArray(metric.exclusions)) errors.push(`${metric.key} requires formula, owner, sources, and exclusions`);
    for (const valueClass of metric.valueClasses ?? []) if (!allowedClasses.has(valueClass)) errors.push(`${metric.key} uses an invalid value class: ${valueClass}`);
    const missing = metric.requiredSources.filter((source) => manifest?.operationalAuthorities?.[source] !== true && formalSources[source] == null);
    if (metric.availability === 'available' && missing.length > 0) errors.push(`${metric.key} cannot be available without sources: ${missing.join(', ')}`);
    if (metric.availability === 'unavailable') blockers.push(`metric:${metric.key}`);
  }
  for (const required of ["mrr", "arr", "mrr-bridge", "recurring-gross-margin", "cash-balance", "runway"]) if (!keys.has(required)) errors.push(`missing required metric definition: ${required}`);
  if (manifest?.decision === 'AUTHORIZED' && blockers.length > 0) errors.push("financial operating authorization is invalid while sources and metrics remain unavailable");

  return { valid: errors.length === 0, errors: [...new Set(errors)], blockers: [...new Set(blockers)] };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../config/financial-operating-manifest.json", import.meta.url), "utf8"));
  const dictionary = JSON.parse(await readFile(new URL("../config/financial-metric-dictionary.json", import.meta.url), "utf8"));
  const result = validateFinancialOperatingSystem(manifest, dictionary);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Financial operating controls valid. Decision: ${manifest.decision}. Metrics available: 0/${dictionary.metrics.length}. Open dependencies: ${result.blockers.length}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
