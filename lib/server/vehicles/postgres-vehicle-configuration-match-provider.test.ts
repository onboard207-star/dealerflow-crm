import { describe, expect, it } from "vitest";

import { PostgresVehicleConfigurationMatchProvider } from "./postgres-vehicle-configuration-match-provider";

describe("PostgresVehicleConfigurationMatchProvider", () => {
  it("maps canonical vehicle, catalog, and verified-match records", async () => {
    const queries: string[] = [];
    const client = {
      query: async (sql: string) => {
        queries.push(sql);
        if (sql === "BEGIN" || sql === "COMMIT" || sql.startsWith("SELECT set_config")) {
          return { rows: [] };
        }
        if (sql.includes("FROM vehicles v")) {
          return {
            rows: [{
              id: "veh_vehicle1",
              organization_id: "org_demo12",
              location_id: "loc_main1",
              year: 2026,
              make: "Honda",
              model: "CR-V",
              trim: "Sport-L Hybrid",
            }],
          };
        }
        if (sql.includes("FROM vehicle_catalog_configurations configuration")) {
          return {
            rows: [{
              id: "vcf_12345678901234567890123456789012",
              year: 2026,
              make: "Honda",
              model: "CR-V",
              trim: "Sport-L Hybrid",
              readiness: "pilot-ready",
            }],
          };
        }
        if (sql.includes("FROM vehicle_catalog_matches")) {
          return {
            rows: [{
              id: "vcm_match1",
              organization_id: "org_demo12",
              vehicle_id: "veh_vehicle1",
              configuration_id: "vcf_12345678901234567890123456789012",
              status: "verified",
              source: "inventory-review",
              evidence: [],
              matched_by: "usr_inventory1",
            }],
          };
        }
        return { rows: [] };
      },
      release: () => undefined,
    };
    const pool = { connect: async () => client };
    const provider = new PostgresVehicleConfigurationMatchProvider(pool, {
      userId: "usr_inventory1",
      organizationId: "org_demo12",
    });

    await provider.transaction(async (session) => {
      expect(await session.findVehicle("org_demo12", "veh_vehicle1")).toMatchObject({
        locationId: "loc_main1",
        trim: "Sport-L Hybrid",
      });
      expect(
        await session.findConfiguration("vcf_12345678901234567890123456789012"),
      ).toMatchObject({ readiness: "pilot-ready", model: "CR-V" });
      expect(await session.findVerified("org_demo12", "veh_vehicle1")).toMatchObject({
        matchedBy: "usr_inventory1",
        status: "verified",
      });
    });

    expect(queries.some((query) => query.includes("JOIN LATERAL"))).toBe(true);
    expect(queries.at(-1)).toBe("COMMIT");
  });

  it("writes only catalog match identity and evidence", async () => {
    let insert = "";
    let values: readonly unknown[] = [];
    const client = {
      query: async (sql: string, parameters?: readonly unknown[]) => {
        if (sql.startsWith("INSERT INTO vehicle_catalog_matches")) {
          insert = sql;
          values = parameters ?? [];
        }
        return { rows: [] };
      },
      release: () => undefined,
    };
    const provider = new PostgresVehicleConfigurationMatchProvider(
      { connect: async () => client },
      { userId: "usr_inventory1", organizationId: "org_demo12" },
    );

    await provider.transaction((session) =>
      session.insert({
        id: "vcm_match1",
        organizationId: "org_demo12",
        vehicleId: "veh_vehicle1",
        configurationId: "vcf_12345678901234567890123456789012",
        status: "verified",
        source: "inventory-review",
        evidence: [{ field: "year", vehicleValue: "2026", catalogValue: "2026" }],
        matchedBy: "usr_inventory1",
      }),
    );

    expect(insert).toContain("INSERT INTO vehicle_catalog_matches");
    expect(insert).not.toMatch(/UPDATE\s+(vehicles|inventory_units)/i);
    expect(values).toHaveLength(8);
  });
});
