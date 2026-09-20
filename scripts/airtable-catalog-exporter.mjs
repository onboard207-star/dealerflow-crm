import { writeFile } from "node:fs/promises";

export const CATALOG_TABLES = [
  "🚘 OEM / Makes", "🚙 Models", "📅 Model Years", "🏷️ Trims", "🧩 Trim Configurations",
  "🎨 Exterior Paint Eligibility", "🪑 Interior Eligibility", "🎨 Color Rules", "⭐ Features",
  "📦 Packages & Options", "📐 Specifications", "⚖️ Model Comparisons", "🎨 OEM Paint Colors",
  "🪑 OEM Interior Materials",
];

const secretKey = /(token|secret|password|credential|auth|api[_ -]?key)/i;

function sanitize(value, path = "") {
  if (Array.isArray(value)) return value.map((item, index) => sanitize(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (secretKey.test(key)) throw new Error(`Refusing to serialize secret-like Airtable field: ${path}.${key}`);
    result[key] = sanitize(item, `${path}.${key}`);
  }
  return result;
}

export function buildSnapshot({ baseId, revision, tables }) {
  if (!baseId || !revision) throw new Error("Airtable base ID and source revision are required.");
  for (const table of CATALOG_TABLES) {
    if (!Array.isArray(tables[table])) throw new Error(`Incomplete Airtable snapshot: missing table ${table}.`);
  }
  const orderedTables = {};
  for (const table of CATALOG_TABLES) {
    orderedTables[table] = tables[table]
      .map((record) => ({ id: record.id, fields: sanitize(record.fields ?? {}, table) }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }
  return { baseId, revision, tables: orderedTables };
}

async function fetchAll(baseId, token, table) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Airtable retrieval failed for ${table}: HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.records)) throw new Error(`Airtable retrieval returned no records array for ${table}.`);
    records.push(...body.records);
    offset = body.offset;
  } while (offset);
  return records;
}

export async function fetchAirtableSnapshot({ baseId, token, revision = `airtable-export-${new Date().toISOString()}` }) {
  if (!token) throw new Error("AIRTABLE_API_TOKEN is required.");
  const tables = {};
  for (const table of CATALOG_TABLES) tables[table] = await fetchAll(baseId, token, table);
  return buildSnapshot({ baseId, revision, tables });
}

async function main() {
  const baseId = process.env.AIRTABLE_VEHICLE_INVENTORY_BASE_ID ?? process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_API_TOKEN;
  const output = process.argv[2] ?? `artifacts/vehicle-catalog-${Date.now()}.json`;
  const snapshot = await fetchAirtableSnapshot({ baseId, token, revision: process.env.AIRTABLE_SOURCE_REVISION });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(JSON.stringify({ output, sourceRevision: snapshot.revision, tableCounts: Object.fromEntries(Object.entries(snapshot.tables).map(([name, rows]) => [name, rows.length])) }) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
