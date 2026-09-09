import { describe, expect, it } from "vitest";

import { fixture, parseArguments } from "./provision-staging-vehicle-intelligence-fixture.mjs";

const args = [
  "--confirm", "PROVISION-P1-02-VEHICLE-INTELLIGENCE-FIXTURE",
  "--expected-database-host", "dpg-isolated-a",
];

describe("staging Vehicle Intelligence fixture", () => {
  it("refuses non-staging and the wrong database host", () => {
    expect(() => parseArguments(args, { APP_ENV: "production", DATABASE_URL: "postgres://u:p@dpg-isolated-a/db" })).toThrow("outside staging");
    expect(() => parseArguments(args, { APP_ENV: "staging", DATABASE_URL: "postgres://u:p@dpg-production-a/db" })).toThrow("does not match");
  });

  it("requires explicit confirmation and preserves the accepted catalog identity", () => {
    expect(() => parseArguments(["--confirm", "wrong", "--expected-database-host", "dpg-isolated-a"], { APP_ENV: "staging", DATABASE_URL: "postgres://u:p@dpg-isolated-a/db" })).toThrow("--confirm");
    expect(fixture).toMatchObject({
      vin: "TESTCATALG26LX001",
      stockNumber: "TEST-VI-LX-001",
      year: 2026,
      make: "Honda",
      model: "Accord",
      trim: "LX",
      configurationId: "vcf_79197e26b9c52b480a8d38d7a899ef15",
      configurationStableKey: "CFG-HONDA-ACCORD-2026-LX-FWD-CVT",
      readiness: "pilot-ready",
    });
  });
});
