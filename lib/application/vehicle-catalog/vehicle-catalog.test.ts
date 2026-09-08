import { describe, expect, it } from "vitest";
import { deriveVehicleCatalogId, validateVehicleCatalogManifest, VehicleCatalogValidationError } from "./vehicle-catalog";

const manifest = {
  sourceSystem: "airtable",
  sourceDataset: "DealerFlow AI Vehicle & Inventory",
  sourceRevision: "2026-09-08",
  nodes: [
    { stableKey: "OEM-HONDA", name: "Honda", sourceSystem: "airtable", sourceRecordId: "recProvenanceOnly", content: { status: "active" } },
    { stableKey: "MODEL-HONDA-CRV", parentStableKey: "OEM-HONDA", name: "CR-V", sourceSystem: "airtable", content: { vehicleClass: "SUV" } },
    { stableKey: "CFG-HONDA-CRV-2026-SPORTL-HYBRID-AWD-ECVT", parentStableKey: "MODEL-HONDA-CRV", name: "Sport-L Hybrid AWD", readiness: "verified" as const, sourceSystem: "airtable", content: { drivetrain: "AWD" } },
  ],
};

describe("vehicle catalog projection", () => {
  it("derives repeatable DealerFlow IDs without using source record IDs", () => {
    const first = validateVehicleCatalogManifest(manifest);
    const second = validateVehicleCatalogManifest({ ...manifest, nodes: manifest.nodes.map((node) => ({ ...node, sourceRecordId: "recChangedProvenance" })) });
    expect(first.map((node) => node.id)).toEqual(second.map((node) => node.id));
    expect(first[0]?.id).toBe(deriveVehicleCatalogId("make", "OEM-HONDA"));
    expect(first[0]?.id).toMatch(/^vma_[a-f0-9]{32}$/);
  });

  it("rejects Airtable IDs as authority and physical inventory fields", () => {
    expect(() => validateVehicleCatalogManifest({ ...manifest, nodes: [{ stableKey: "recABCDEFGHIJKLMN", name: "Bad", sourceSystem: "airtable", content: { vin: "2HKRS6H98SH123456" } }] })).toThrow(VehicleCatalogValidationError);
  });

  it("rejects broken and duplicate relationships", () => {
    expect(() => validateVehicleCatalogManifest({ ...manifest, nodes: [manifest.nodes[0]!, { ...manifest.nodes[0]!, parentStableKey: "MODEL-MISSING" }] })).toThrow(VehicleCatalogValidationError);
  });
});
