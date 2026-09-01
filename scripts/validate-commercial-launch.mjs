import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const requiredScaleEvidence = [
  "freshSecondDealerPassed",
  "firstPilotStable",
  "supportCapacityProven",
  "implementationCapacityProven",
  "providerReliabilityProven",
  "productionReliabilityProven",
  "firstTenIsolationPassed",
  "firstTenLoadPassed",
  "unitEconomicsAuthoritative",
];

const prohibitedBoundaries = [
  "demoTenantMayBecomeProduction",
  "commercialStatusMayOverrideLaunchGate",
  "salesMayOverrideStopSell",
  "estimatedUsageMayTriggerBilling",
  "aiMayApprovePricingOrGo",
  "unsupportedCapabilitiesMayAppearInProposal",
];

export function validateCommercialLaunch(manifest, maturityCatalog, commercialCatalog) {
  const errors = [];
  const blockers = [];
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (!['AUTHORIZED', 'NOT_AUTHORIZED'].includes(manifest?.decision)) errors.push("commercial decision is invalid");
  if (manifest?.productizationDecision !== 'AUTHORIZED') blockers.push("productizationDecision");

  for (const name of requiredScaleEvidence) {
    if (manifest?.scaleEvidence?.[name] !== true) blockers.push(name);
  }
  for (const name of prohibitedBoundaries) {
    if (manifest?.boundaries?.[name] !== false) errors.push(`${name} must remain false`);
  }

  const maturityByKey = new Map((maturityCatalog?.modules ?? []).map((module) => [module.key, module]));
  const seen = new Set();
  const allowedSellStates = new Set(commercialCatalog?.allowedSellStates ?? []);
  for (const capability of commercialCatalog?.capabilities ?? []) {
    if (!capability.moduleKey || seen.has(capability.moduleKey)) errors.push(`commercial module key is missing or duplicated: ${capability.moduleKey ?? 'unknown'}`);
    seen.add(capability.moduleKey);
    const maturity = maturityByKey.get(capability.moduleKey);
    if (!maturity) errors.push(`${capability.moduleKey} is absent from the module maturity catalog`);
    if (!allowedSellStates.has(capability.sellState)) errors.push(`${capability.moduleKey} has an invalid sell state`);
    if (!capability.reason) errors.push(`${capability.moduleKey} requires a sell-state reason`);
    if (capability.sellState === 'sell' && maturity?.state !== 'production-supported') {
      errors.push(`${capability.moduleKey} cannot be sellable at maturity ${maturity?.state ?? 'unknown'}`);
    }
    if (capability.sellState === 'sell' && manifest?.decision !== 'AUTHORIZED') {
      errors.push(`${capability.moduleKey} cannot be sellable before commercial authorization`);
    }
    if (capability.sellState === 'unavailable' && maturity?.state === 'production-supported') {
      errors.push(`${capability.moduleKey} availability contradicts its production-supported maturity`);
    }
  }
  for (const key of maturityByKey.keys()) {
    if (!seen.has(key)) errors.push(`${key} is missing from the commercial capability catalog`);
  }

  if (manifest?.decision === 'AUTHORIZED' && blockers.length > 0) {
    errors.push(`commercial launch is invalid while evidence remains open: ${blockers.join(', ')}`);
  }
  if (manifest?.activation?.broadSellingEnabled === true && manifest?.decision !== 'AUTHORIZED') {
    errors.push("broad selling requires commercial authorization");
  }
  for (const [name, value] of Object.entries(manifest?.activation ?? {})) {
    if (value === true && manifest?.decision !== 'AUTHORIZED') errors.push(`${name} requires commercial authorization`);
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)], blockers: [...new Set(blockers)] };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../config/commercial-launch-manifest.json", import.meta.url), "utf8"));
  const maturity = JSON.parse(await readFile(new URL("../config/module-maturity-catalog.json", import.meta.url), "utf8"));
  const commercial = JSON.parse(await readFile(new URL("../config/commercial-capability-catalog.json", import.meta.url), "utf8"));
  const result = validateCommercialLaunch(manifest, maturity, commercial);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Commercial launch controls valid. Decision: ${manifest.decision}. Open evidence: ${result.blockers.join(", ") || "none"}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
