import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const forbiddenClaims = ["soc 2 certified", "soc 2 compliant", "iso 27001 certified", "hipaa compliant", "pci compliant", "gdpr compliant", "ccpa compliant"];

export function validateTrustProgram(controlsRegistry, evidenceRegistry) {
  const errors = [];
  const blockers = [];
  if (controlsRegistry?.schemaVersion !== 1 || evidenceRegistry?.schemaVersion !== 1) errors.push("trust registries must use schemaVersion 1");
  const asOf = Date.parse(`${evidenceRegistry?.asOf}T00:00:00Z`);
  if (Number.isNaN(asOf)) errors.push("evidence asOf date is invalid");

  for (const [name, value] of Object.entries(controlsRegistry?.certifications ?? {})) {
    if (value !== false) errors.push(`${name} must remain false without authorized independent evidence`);
  }
  const evidence = new Map();
  for (const item of evidenceRegistry?.evidence ?? []) {
    if (!item.id || evidence.has(item.id)) errors.push(`evidence ID is missing or duplicated: ${item.id ?? 'unknown'}`);
    evidence.set(item.id, item);
    if (!['current', 'stale', 'missing'].includes(item.status)) errors.push(`${item.id} has an invalid evidence status`);
    if (item.status === 'missing' && (item.verifiedAt !== null || item.source !== null)) errors.push(`${item.id} must not invent source or verification date while missing`);
    if (item.status !== 'missing') {
      const verified = Date.parse(`${item.verifiedAt}T00:00:00Z`);
      if (Number.isNaN(verified)) errors.push(`${item.id} requires a valid verifiedAt date`);
      else if (asOf - verified > item.maxAgeDays * 86_400_000 && item.status === 'current') errors.push(`${item.id} is expired and cannot remain current`);
    }
  }

  const allowedStatuses = new Set(controlsRegistry?.allowedStatuses ?? []);
  const controlIds = new Set();
  for (const control of controlsRegistry?.controls ?? []) {
    if (!control.id || controlIds.has(control.id)) errors.push(`control ID is missing or duplicated: ${control.id ?? 'unknown'}`);
    controlIds.add(control.id);
    if (!allowedStatuses.has(control.status)) errors.push(`${control.id} has an invalid status`);
    if (!control.ownerRole || !control.objective || !control.customerSafeStatement) errors.push(`${control.id} requires owner, objective, and customer-safe statement`);
    const statement = String(control.customerSafeStatement).toLowerCase();
    for (const claim of forbiddenClaims) if (statement.includes(claim)) errors.push(`${control.id} contains an unsupported certification/compliance claim`);
    const linked = (control.evidenceIds ?? []).map((id) => evidence.get(id));
    if (linked.some((item) => item === undefined)) errors.push(`${control.id} references unknown evidence`);
    const current = linked.filter((item) => item?.status === 'current');
    if (['tested', 'monitored', 'independently-assessed'].includes(control.status) && current.length === 0) errors.push(`${control.id} cannot be ${control.status} without current evidence`);
    if (control.status === 'independently-assessed' && !current.some((item) => item?.independent === true)) errors.push(`${control.id} requires current independent evidence`);
    if (linked.some((item) => item?.status === 'missing' || item?.status === 'stale')) blockers.push(control.id);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], blockers: [...new Set(blockers)] };
}

async function main() {
  const controls = JSON.parse(await readFile(new URL("../config/trust-control-registry.json", import.meta.url), "utf8"));
  const evidence = JSON.parse(await readFile(new URL("../config/trust-evidence-registry.json", import.meta.url), "utf8"));
  const result = validateTrustProgram(controls, evidence);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write(`Trust controls valid. Controls: ${controls.controls.length}. Evidence blockers: ${result.blockers.join(", ") || "none"}. Certifications claimed: none.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
