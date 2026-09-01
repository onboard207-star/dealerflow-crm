import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const authorityNames = [
  "appIdentity", "publisherIdentity", "tenantInstallation", "oauthAppAuthorization",
  "extensionScopes", "developerSandboxCredentials", "publicApiVersioning",
  "developerEventSubscriptions", "extensionUsageLedger", "marketplaceBilling",
  "certificationWorkflow",
];
const activationNames = [
  "privateAppsEnabled", "partnerAppsEnabled", "publicListingsEnabled",
  "thirdPartyUiEnabled", "thirdPartyAiToolsEnabled", "arbitraryExtensionCodeEnabled",
];
const boundaryNames = [
  "internalRoutesArePublicApi", "providerWebhookIsDeveloperWebhook", "resellerIsTrustedPublisher",
  "appMayUsePlatformCredentials", "appMayBypassTenantAuthorization", "appMayBypassConsent",
  "appMayReadRawDatabase", "uninstallDeletesCanonicalRecords",
];

export function validateDeveloperPlatform(manifest, registry) {
  const errors = [];
  const blockers = [];
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  for (const [name, decision] of Object.entries(manifest?.recommendations ?? {})) {
    if (!['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(decision)) errors.push(`${name} recommendation is invalid`);
  }
  for (const name of authorityNames) {
    if (manifest?.authorities?.[name] !== false) errors.push(`${name} must remain disabled until implemented and certified`);
    blockers.push(name);
  }
  for (const name of activationNames) if (manifest?.activation?.[name] !== false) errors.push(`${name} must remain disabled`);
  for (const name of boundaryNames) if (manifest?.boundaries?.[name] !== false) errors.push(`${name} must remain false`);

  if (registry?.schemaVersion !== 1 || !Array.isArray(registry?.surfaces)) errors.push("extension surface registry is invalid");
  const allowed = new Set(registry?.allowedClassifications ?? []);
  const ids = new Set();
  for (const surface of registry?.surfaces ?? []) {
    if (!surface.id || ids.has(surface.id)) errors.push(`surface ID is missing or duplicated: ${surface.id ?? 'unknown'}`);
    ids.add(surface.id);
    if (!allowed.has(surface.classification)) errors.push(`${surface.id} has an invalid classification`);
    if (!surface.path || !surface.consumer || !surface.notes) errors.push(`${surface.id} requires path, consumer, and notes`);
    if (surface.classification === 'supported-private' || surface.classification === 'supported-public') errors.push(`${surface.id} cannot be supported before developer-platform authorization`);
    if (surface.versionedDeveloperContract !== false) errors.push(`${surface.id} is not an approved versioned developer contract`);
  }
  for (const decision of Object.values(manifest?.recommendations ?? {})) {
    if (decision === 'GO' && blockers.length > 0) errors.push("ecosystem GO is invalid while developer authorities are absent");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], blockers };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../config/developer-platform-manifest.json", import.meta.url), "utf8"));
  const registry = JSON.parse(await readFile(new URL("../config/extension-surface-registry.json", import.meta.url), "utf8"));
  const result = validateDeveloperPlatform(manifest, registry);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Developer platform controls valid. Private: ${manifest.recommendations.privateEcosystem}; partner: ${manifest.recommendations.partnerEcosystem}; public: ${manifest.recommendations.publicMarketplace}. Missing authorities: ${result.blockers.length}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
