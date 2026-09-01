import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const requiredGateNames = [
  "zeroP0",
  "noPilotBlockingP1",
  "tenantIsolationAndSecurity",
  "coreGoldenJourneys",
  "providerDegradedBehavior",
  "resetReseedAcceptance",
  "backupRestore",
  "rollbackPath",
  "approvedPilotScope",
  "namedLaunchOwner",
  "productionParity",
  "roleAcceptance",
  "monitoringAndAlertOwnership",
];

const riskyFeatureNames = [
  "autonomousCustomerSends",
  "longTermNurture",
  "aiDestructiveOrBulkWrites",
  "recordingOrTranscription",
  "realBilling",
  "resellerActivation",
  "experimentation",
  "lenderOrCreditSubmission",
  "eSignature",
  "dmsPosting",
  "autonomousPricing",
  "automatedReviewSolicitation",
];

export function validatePilotCutoverManifest(manifest) {
  const errors = [];
  const blockers = [];

  if (manifest?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(manifest?.decision)) {
    errors.push("decision must be GO, CONDITIONAL_GO, or NO_GO");
  }

  for (const gateName of requiredGateNames) {
    const gate = manifest?.gates?.[gateName];
    if (!gate) {
      errors.push(`missing required gate: ${gateName}`);
      continue;
    }
    if (!['verified', 'partial', 'blocked'].includes(gate.status)) {
      errors.push(`${gateName} has an invalid status`);
    }
    if (gate.status !== 'verified') blockers.push(gateName);
  }

  for (const featureName of riskyFeatureNames) {
    if (manifest?.featurePosture?.[featureName] !== false) {
      errors.push(`${featureName} must remain disabled until separately approved`);
    }
  }

  if (manifest?.decision === 'GO' && blockers.length > 0) {
    errors.push(`GO is invalid while prerequisite gates remain open: ${blockers.join(', ')}`);
  }
  if (manifest?.decision === 'GO' && !manifest?.release?.approvedBy) {
    errors.push("GO requires an authorized human approver");
  }
  if (manifest?.decision === 'GO' && !manifest?.release?.approvedAt) {
    errors.push("GO requires an approval timestamp");
  }
  if (manifest?.decision === 'GO' && manifest?.productionInventory?.status !== 'verified') {
    errors.push("GO requires a directly verified production inventory");
  }

  return { valid: errors.length === 0, errors, blockers };
}

async function main() {
  const manifestUrl = new URL("../config/pilot-launch-manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const result = validatePilotCutoverManifest(manifest);
  if (!result.valid) {
    throw new Error(result.errors.join("\n"));
  }
  process.stdout.write(
    `Pilot cutover manifest valid. Decision: ${manifest.decision}. Open gates: ${result.blockers.join(", ") || "none"}.\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
