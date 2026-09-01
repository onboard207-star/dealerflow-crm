import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const evidenceMaturity = new Set(["Code Complete", "Staging Verified", "Pilot Ready", "Pilot Proven", "GA", "Limited Availability"]);
const stagingMaturity = new Set(["Staging Verified", "Pilot Ready", "Pilot Proven", "GA", "Limited Availability"]);
const commerciallyEligible = new Set(["Pilot Ready", "Pilot Proven", "GA", "Limited Availability"]);

export function validateProductPortfolio(registry, domainMap, roadmap) {
  const errors = [];
  if (registry?.schemaVersion !== 1 || domainMap?.schemaVersion !== 1 || roadmap?.schemaVersion !== 1) {
    errors.push("portfolio registries must use schemaVersion 1");
  }

  const allowedMaturity = new Set(registry?.allowedMaturityStates ?? []);
  const allowedCommercial = new Set(registry?.allowedCommercialStates ?? []);
  const capabilities = registry?.capabilities ?? [];
  const capabilityIds = new Set();
  for (const capability of capabilities) {
    if (!/^CAP-[A-Z]+-\d{3}$/.test(capability.id ?? "") || capabilityIds.has(capability.id)) {
      errors.push(`capability id is invalid or duplicated: ${capability.id ?? "missing"}`);
    }
    capabilityIds.add(capability.id);
    if (!allowedMaturity.has(capability.maturity)) errors.push(`${capability.id} has an invalid maturity`);
    if (!allowedCommercial.has(capability.commercialSupport)) errors.push(`${capability.id} has an invalid commercial support state`);
    if (!capability.domain || !capability.ownerArea || !capability.productModule || !capability.lastVerified) errors.push(`${capability.id} is missing governance metadata`);
    if (!Array.isArray(capability.architectureRefs) || capability.architectureRefs.length === 0) errors.push(`${capability.id} requires an architecture reference`);
    if (evidenceMaturity.has(capability.maturity) && (!Array.isArray(capability.implementationRefs) || capability.implementationRefs.length === 0)) errors.push(`${capability.id} requires an implementation reference at ${capability.maturity}`);
    if (evidenceMaturity.has(capability.maturity) && (!Array.isArray(capability.evidence) || capability.evidence.length === 0)) errors.push(`${capability.id} requires evidence at ${capability.maturity}`);
    if (stagingMaturity.has(capability.maturity) && !(capability.evidence ?? []).some((item) => item.kind === "staging")) errors.push(`${capability.id} requires staging evidence at ${capability.maturity}`);
    if (capability.commercialSupport === "Pilot Only" && !commerciallyEligible.has(capability.maturity)) errors.push(`${capability.id} cannot be Pilot Only at ${capability.maturity}`);
    if (capability.commercialSupport === "Supported" && !new Set(["GA", "Limited Availability"]).has(capability.maturity)) errors.push(`${capability.id} cannot be Supported at ${capability.maturity}`);
    if ((capability.providerDependencies ?? []).length > 0 && (capability.blockers ?? []).length === 0 && commerciallyEligible.has(capability.maturity)) errors.push(`${capability.id} requires resolved provider evidence before commercial maturity`);
  }

  for (const capability of capabilities) {
    for (const dependency of [...(capability.hardDependencies ?? []), ...(capability.softDependencies ?? [])]) {
      if (!capabilityIds.has(dependency)) errors.push(`${capability.id} references unknown dependency ${dependency}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(capabilities.map((capability) => [capability.id, capability]));
  const visit = (id) => {
    if (visiting.has(id)) {
      errors.push(`hard dependency cycle includes ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.hardDependencies ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of capabilityIds) visit(id);

  const domainIds = new Set();
  const mappedCapabilities = new Set();
  for (const domain of domainMap?.domains ?? []) {
    if (!domain.id || domainIds.has(domain.id)) errors.push(`domain id is missing or duplicated: ${domain.id ?? "missing"}`);
    domainIds.add(domain.id);
    for (const capabilityId of domain.capabilityIds ?? []) {
      if (!capabilityIds.has(capabilityId)) errors.push(`${domain.id} references unknown capability ${capabilityId}`);
      if (mappedCapabilities.has(capabilityId)) errors.push(`${capabilityId} is mapped to more than one domain`);
      mappedCapabilities.add(capabilityId);
      if (byId.get(capabilityId)?.domain !== domain.id) errors.push(`${capabilityId} domain does not match ${domain.id}`);
    }
  }
  for (const id of capabilityIds) if (!mappedCapabilities.has(id)) errors.push(`${id} is missing from the product domain map`);

  const allowedHorizons = new Set(roadmap?.horizons ?? []);
  const outcomeIds = new Set();
  const nowCapabilities = new Set();
  for (const outcome of roadmap?.outcomes ?? []) {
    if (!/^OUT-(NOW|NEXT|LATER|NOTNOW)-\d{3}$/.test(outcome.id ?? "") || outcomeIds.has(outcome.id)) errors.push(`outcome id is invalid or duplicated: ${outcome.id ?? "missing"}`);
    outcomeIds.add(outcome.id);
    if (!allowedHorizons.has(outcome.horizon)) errors.push(`${outcome.id} has an invalid horizon`);
    if (!outcome.outcome || !Array.isArray(outcome.successEvidence) || outcome.successEvidence.length === 0) errors.push(`${outcome.id} requires an outcome and success evidence`);
    for (const capabilityId of outcome.capabilityIds ?? []) {
      if (!capabilityIds.has(capabilityId)) errors.push(`${outcome.id} references unknown capability ${capabilityId}`);
      if (outcome.horizon === "Now") nowCapabilities.add(capabilityId);
    }
  }
  for (const required of ["CAP-OPS-001", "CAP-DATA-001", "CAP-INV-002", "CAP-COM-001", "CAP-PLT-001"]) {
    if (!nowCapabilities.has(required)) errors.push(`Now roadmap is missing pilot dependency ${required}`);
  }
  for (const forbidden of ["CAP-SVC-001", "CAP-COMMERCIAL-001", "CAP-EXT-001"]) {
    if (nowCapabilities.has(forbidden)) errors.push(`Now roadmap improperly includes deferred capability ${forbidden}`);
  }

  const maturityCounts = Object.fromEntries([...allowedMaturity].map((state) => [state, capabilities.filter((capability) => capability.maturity === state).length]));
  return { valid: errors.length === 0, errors: [...new Set(errors)], maturityCounts };
}

async function main() {
  const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
  const registry = await read("capability-implementation-registry.json");
  const domainMap = await read("product-domain-map.json");
  const roadmap = await read("roadmap-outcome-registry.json");
  const result = validateProductPortfolio(registry, domainMap, roadmap);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  const supported = registry.capabilities.filter((capability) => capability.commercialSupport === "Supported").length;
  process.stdout.write(`Product portfolio valid. Capabilities: ${registry.capabilities.length}. Commercially supported: ${supported}. Now outcomes: ${roadmap.outcomes.filter((outcome) => outcome.horizon === "Now").length}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
