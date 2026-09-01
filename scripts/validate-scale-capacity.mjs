import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const requiredMeasurementKeys = [
  "active-rooftops", "concurrent-users", "lead-ingestion", "communications",
  "inventory-units", "media-uploads", "ai-requests", "background-jobs",
  "webhooks", "imports", "document-generation", "support-cases",
  "database-connections", "api-latency-p95",
];

const evidenceFor25 = [
  "firstTenStable", "productionMetricsAudited", "providerQuotasAudited",
  "twentyFiveRooftopLoadPassed", "noisyNeighborPassed", "providerSaturationPassed",
  "migrationAtScalePassed", "recoveryAtScalePassed", "crossTenantScaleIsolationPassed",
  "supportCapacityProven", "implementationCapacityProven", "costInstrumentationVerified",
  "releaseCohortRollbackPassed",
];

const evidenceFor50 = [...evidenceFor25, "fiftyRooftopLoadPassed"];

export function validateScaleCapacity(manifest) {
  const errors = [];
  const blockers25 = [];
  const blockers50 = [];
  if (manifest?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(manifest?.recommendations?.twentyFiveRooftops)) errors.push("25-rooftop recommendation is invalid");
  if (!['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(manifest?.recommendations?.fiftyRooftops)) errors.push("50-rooftop recommendation is invalid");
  if (manifest?.commercialLaunchDecision !== 'AUTHORIZED') {
    blockers25.push("commercialLaunchDecision");
    blockers50.push("commercialLaunchDecision");
  }

  const measurements = new Map();
  for (const item of manifest?.measurements ?? []) {
    if (!item.key || measurements.has(item.key)) errors.push(`measurement key is missing or duplicated: ${item.key ?? 'unknown'}`);
    measurements.set(item.key, item);
    if (!['measured', 'unknown'].includes(item.status)) errors.push(`${item.key} has an invalid status`);
    const values = [item.measuredCapacity, item.normalUtilization, item.warningThreshold, item.criticalThreshold, item.headroom];
    if (item.status === 'unknown' && values.some((value) => value !== null)) errors.push(`${item.key} must not contain invented values while unknown`);
    if (item.status === 'measured' && values.some((value) => typeof value !== 'number')) errors.push(`${item.key} requires numeric measured capacity and thresholds`);
    if (item.status !== 'measured') {
      blockers25.push(`measurement:${item.key}`);
      blockers50.push(`measurement:${item.key}`);
    }
  }
  for (const key of requiredMeasurementKeys) if (!measurements.has(key)) errors.push(`missing required measurement: ${key}`);

  for (const name of evidenceFor25) if (manifest?.requiredEvidence?.[name] !== true) blockers25.push(name);
  for (const name of evidenceFor50) if (manifest?.requiredEvidence?.[name] !== true) blockers50.push(name);

  if (manifest?.recommendations?.twentyFiveRooftops === 'GO' && blockers25.length > 0) errors.push(`25-rooftop GO is invalid while evidence remains open: ${blockers25.join(', ')}`);
  if (manifest?.recommendations?.fiftyRooftops === 'GO' && blockers50.length > 0) errors.push(`50-rooftop GO is invalid while evidence remains open: ${blockers50.join(', ')}`);
  if (manifest?.recommendations?.fiftyRooftops === 'GO' && manifest?.recommendations?.twentyFiveRooftops !== 'GO') errors.push("50-rooftop GO requires 25-rooftop GO");

  return { valid: errors.length === 0, errors, blockers25: [...new Set(blockers25)], blockers50: [...new Set(blockers50)] };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../config/scale-capacity-manifest.json", import.meta.url), "utf8"));
  const result = validateScaleCapacity(manifest);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Scale capacity controls valid. 25 rooftops: ${manifest.recommendations.twentyFiveRooftops} (${result.blockers25.length} open). 50 rooftops: ${manifest.recommendations.fiftyRooftops} (${result.blockers50.length} open).\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
