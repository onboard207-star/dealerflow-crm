import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const recommendationNames = ["oneHundredRooftops", "enterpriseGroupRollout", "partnerResellerActivation"];
const authorityNames = [
  "enterpriseAccounts", "dealerGroups", "partnerOrganizations", "delegatedAdministration",
  "platformAdministration", "crossTenantSupport", "enterpriseSso", "scim",
  "partnerApis", "enterpriseBilling", "usageLedger", "regionalTenantRouting",
];
const evidenceNames = [
  "fiftyRooftopGatePassed", "measuredHundredRooftopLoad", "enterpriseNoisyNeighborPassed",
  "failureDomainPassed", "crossGroupIsolationPassed", "partnerDelegationSecurityPassed",
  "whiteLabelIsolationPassed", "enterpriseRolloutPassed", "enterpriseRecoveryPassed",
  "providerCapacityProven", "supportImplementationCapacityProven", "costAllocationVerified",
  "enterpriseIdentityAccepted", "apiWebhookGovernanceAccepted", "partnerCommercialTermsApproved",
];
const immutableSafetyFields = ["tenantIsolation", "authorization", "auditIdentity", "providerSignatureVerification", "consentAndOptOut"];

export function validateEnterpriseReadiness(manifest, inheritance) {
  const errors = [];
  const blockers = [];
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (manifest?.lowerScaleGate?.fiftyRooftops !== 'GO') blockers.push("fiftyRooftopGatePassed");
  for (const name of recommendationNames) {
    if (!['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(manifest?.recommendations?.[name])) errors.push(`${name} recommendation is invalid`);
  }
  for (const name of evidenceNames) if (manifest?.requiredEvidence?.[name] !== true) blockers.push(name);

  for (const name of authorityNames) {
    if (manifest?.authorities?.[name] !== false) errors.push(`${name} must remain disabled until its canonical authority exists`);
  }
  if (manifest?.existingBoundaries?.partnerHasImplicitCustomerAccess !== false) errors.push("partners may not receive implicit customer access");
  if (manifest?.existingBoundaries?.enterpriseContractGrantsRuntimeAccess !== false) errors.push("commercial scope may not grant runtime access");
  if (manifest?.existingBoundaries?.brandingMayRemoveSecurityControls !== false) errors.push("branding may not remove security controls");
  if (manifest?.existingBoundaries?.largeTenantMayBypassFairness !== false) errors.push("enterprise tenants may not bypass fairness controls");
  if (manifest?.existingBoundaries?.certificationClaimsAuthorized !== false) errors.push("unverified certification claims are prohibited");

  if (inheritance?.schemaVersion !== 1) errors.push("inheritance registry schemaVersion must be 1");
  const currentLayers = new Set(inheritance?.currentLayers ?? []);
  const deferredLayers = new Set(inheritance?.deferredLayers ?? []);
  for (const layer of currentLayers) if (deferredLayers.has(layer)) errors.push(`${layer} cannot be both current and deferred`);
  const fields = new Map();
  for (const field of inheritance?.fields ?? []) {
    if (!field.key || fields.has(field.key)) errors.push(`configuration field is missing or duplicated: ${field.key ?? 'unknown'}`);
    fields.set(field.key, field);
    if (field.currentOverrideLayer !== null && !currentLayers.has(field.currentOverrideLayer)) errors.push(`${field.key} uses a non-current override layer`);
    if (field.securityRequired === true && field.currentOverrideLayer !== null) errors.push(`${field.key} is a platform safety control and cannot be tenant-overridden`);
  }
  for (const key of immutableSafetyFields) if (!fields.has(key)) errors.push(`missing platform safety field: ${key}`);

  for (const name of recommendationNames) {
    if (manifest?.recommendations?.[name] === 'GO' && blockers.length > 0) errors.push(`${name} GO is invalid while enterprise evidence remains open`);
  }
  return { valid: errors.length === 0, errors, blockers: [...new Set(blockers)] };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../config/enterprise-readiness-manifest.json", import.meta.url), "utf8"));
  const inheritance = JSON.parse(await readFile(new URL("../config/configuration-inheritance-registry.json", import.meta.url), "utf8"));
  const result = validateEnterpriseReadiness(manifest, inheritance);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Enterprise controls valid. 100 rooftops: ${manifest.recommendations.oneHundredRooftops}; group: ${manifest.recommendations.enterpriseGroupRollout}; partner: ${manifest.recommendations.partnerResellerActivation}. Open evidence: ${result.blockers.length}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
