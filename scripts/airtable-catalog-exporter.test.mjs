import { describe, expect, it } from "vitest";
import { buildSnapshot, CATALOG_TABLES } from "./airtable-catalog-exporter.mjs";

const emptyTables = Object.fromEntries(CATALOG_TABLES.map((name) => [name, []]));

describe("governed Airtable catalog exporter", () => {
  it("requires every catalog table and preserves linked record IDs and semantic fields", () => {
    const tables = { ...emptyTables, "🧩 Trim Configurations": [{ id: "recCfg", fields: {
      "Configuration ID": "CFG-TEST", "⭐ Features": [{ id: "recFeature" }], "📐 Specifications": [{ id: "recSpec" }],
    } }], "⭐ Features": [{ id: "recFeature", fields: { "Feature Concept Key": "concept.apple-carplay", "Replaces Features": [{ id: "recOld" }] } }], "📐 Specifications": [{ id: "recSpec", fields: { "Metric Concept Key": "metric.range", "Measurement Basis": "EPA", "Charge Start SOC": 20, "Charge End SOC": 80 } }] };
    const snapshot = buildSnapshot({ baseId: "app_test", revision: "r1", tables });
    expect(snapshot.tables["🧩 Trim Configurations"][0].fields["⭐ Features"]).toEqual([{ id: "recFeature" }]);
    expect(snapshot.tables["⭐ Features"][0].fields["Feature Concept Key"]).toBe("concept.apple-carplay");
    expect(snapshot.tables["📐 Specifications"][0].fields["Charge End SOC"]).toBe(80);
  });

  it("rejects incomplete snapshots and secret-like fields", () => {
    expect(() => buildSnapshot({ baseId: "app_test", revision: "r1", tables: {} })).toThrow(/missing table/);
    const tables = { ...emptyTables, "⭐ Features": [{ id: "rec", fields: { "API Token": "never" } }] };
    expect(() => buildSnapshot({ baseId: "app_test", revision: "r1", tables })).toThrow(/secret-like/);
  });

  it("omits physical inventory authority and is deterministic", () => {
    const a = buildSnapshot({ baseId: "app_test", revision: "r1", tables: { ...emptyTables, "⭐ Features": [{ id: "recB", fields: {} }, { id: "recA", fields: {} }] } });
    const b = buildSnapshot({ baseId: "app_test", revision: "r1", tables: { ...emptyTables, "⭐ Features": [{ id: "recA", fields: {} }, { id: "recB", fields: {} }] } });
    expect(a).toEqual(b);
    expect(a.tables["🚗 Inventory Units"]).toBeUndefined();
  });
});
