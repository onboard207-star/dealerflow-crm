import { createHash } from "node:crypto";

export type VehicleCatalogEntityKind = "make" | "model" | "model-year" | "trim" | "configuration" | "attribute" | "comparison";
export type VehicleCatalogReadiness = "needs-review" | "in-progress" | "verified" | "pilot-ready" | "blocked" | "not-applicable";
export type VehicleCatalogAttributeKind = "exterior-color" | "interior-color" | "feature" | "package" | "specification";

const prefixes: Readonly<Record<VehicleCatalogEntityKind, string>> = {
  make: "vma", model: "vmo", "model-year": "vmy", trim: "vtr", configuration: "vcf", attribute: "vca", comparison: "vcp",
};

export interface VehicleCatalogSourceRef {
  sourceSystem: string;
  sourceRecordId?: string;
}

export interface VehicleCatalogNode extends VehicleCatalogSourceRef {
  stableKey: string;
  name: string;
  parentStableKey?: string;
  readiness?: VehicleCatalogReadiness;
  content: Readonly<Record<string, unknown>>;
  links?: readonly VehicleCatalogLink[];
}

export interface VehicleCatalogLink {
  targetStableKey: string;
  relationship: "standard" | "optional" | "available" | "excluded" | "requires";
  sourceRecordId?: string;
  conditions?: Readonly<Record<string, unknown>>;
}

export interface VehicleCatalogManifest {
  sourceSystem: string;
  sourceDataset: string;
  sourceRevision: string;
  nodes: readonly VehicleCatalogNode[];
}

export interface ValidatedVehicleCatalogNode extends VehicleCatalogNode {
  id: string;
  contentSha256: string;
}

export class VehicleCatalogValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Vehicle catalog projection is invalid.");
    this.name = "VehicleCatalogValidationError";
  }
}

export function deriveVehicleCatalogId(kind: VehicleCatalogEntityKind, stableKey: string): string {
  const normalized = normalizeStableKey(stableKey);
  return `${prefixes[kind]}_${createHash("sha256").update(`dealerflow:vehicle-catalog:${kind}:${normalized}`).digest("hex").slice(0, 32)}`;
}

export function validateVehicleCatalogManifest(manifest: VehicleCatalogManifest): readonly ValidatedVehicleCatalogNode[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  if (!manifest.sourceSystem.trim()) issues.push("sourceSystem is required.");
  if (!manifest.sourceDataset.trim()) issues.push("sourceDataset is required.");
  if (!manifest.sourceRevision.trim()) issues.push("sourceRevision is required.");

  for (const [index, node] of manifest.nodes.entries()) {
    const label = `nodes[${index}]`;
    const stableKey = normalizeStableKey(node.stableKey);
    if (!/^[A-Z0-9][A-Z0-9_-]{2,219}$/.test(stableKey)) issues.push(`${label}.stableKey is invalid.`);
    if (/^rec[a-zA-Z0-9]{10,}$/.test(node.stableKey)) issues.push(`${label}.stableKey must not be an Airtable record ID.`);
    if (keys.has(stableKey)) issues.push(`${label}.stableKey is duplicated.`);
    keys.add(stableKey);
    if (!node.name.trim()) issues.push(`${label}.name is required.`);
    if (node.sourceSystem !== manifest.sourceSystem) issues.push(`${label}.sourceSystem must match the manifest.`);
    for (const forbidden of ["vin", "stockNumber", "price", "listPrice", "organizationId", "locationId"])
      if (Object.hasOwn(node.content, forbidden)) issues.push(`${label}.content must not contain physical inventory field ${forbidden}.`);
  }

  for (const [index, node] of manifest.nodes.entries()) {
    if (node.parentStableKey && !keys.has(normalizeStableKey(node.parentStableKey))) issues.push(`nodes[${index}].parentStableKey does not resolve within the manifest.`);
    const links = new Set<string>();
    for (const [linkIndex, link] of (node.links ?? []).entries()) {
      const target = normalizeStableKey(link.targetStableKey);
      const signature = `${target}:${link.relationship}`;
      if (!keys.has(target)) issues.push(`nodes[${index}].links[${linkIndex}] does not resolve within the manifest.`);
      if (links.has(signature)) issues.push(`nodes[${index}].links[${linkIndex}] is duplicated.`);
      links.add(signature);
    }
  }
  if (issues.length) throw new VehicleCatalogValidationError(issues);

  return manifest.nodes.map((node) => ({
    ...node,
    stableKey: normalizeStableKey(node.stableKey),
    ...(node.parentStableKey ? { parentStableKey: normalizeStableKey(node.parentStableKey) } : {}),
    ...(node.links ? { links: node.links.map((link) => ({ ...link, targetStableKey: normalizeStableKey(link.targetStableKey) })) } : {}),
    id: deriveVehicleCatalogId(inferKind(node.stableKey), node.stableKey),
    contentSha256: createHash("sha256").update(stableJson(node.content)).digest("hex"),
  }));
}

function normalizeStableKey(value: string) { return value.trim().toUpperCase(); }
function inferKind(key: string): VehicleCatalogEntityKind {
  const value = normalizeStableKey(key);
  if (value.startsWith("OEM-")) return "make";
  if (value.startsWith("MODEL-")) return "model";
  if (value.startsWith("MY-") || value.startsWith("MODEL-YEAR-")) return "model-year";
  if (value.startsWith("TRIM-")) return "trim";
  if (value.startsWith("CFG-")) return "configuration";
  if (value.startsWith("COMPARISON-") || value.startsWith("CMP-")) return "comparison";
  return "attribute";
}
function stableJson(value: Readonly<Record<string, unknown>>) {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}
