import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticate, match } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  match: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({ getDatabasePool: () => ({}) }));
vi.mock("@/lib/server/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/auth")>();
  return {
    ...actual,
    PostgresMembershipReader: class {},
    authenticateOrganizationRequest: authenticate,
  };
});
vi.mock("@/lib/server/vehicles", () => ({
  PostgresVehicleConfigurationMatchProvider: class {},
}));
vi.mock("@/lib/application/vehicle-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/application/vehicle-catalog")>();
  return {
    ...actual,
    VehicleConfigurationMatchService: class {
      match = match;
    },
  };
});

import { POST } from "./route";

const context = {
  params: Promise.resolve({ organizationId: "org_demo12", vehicleId: "veh_vehicle1" }),
};

describe("vehicle catalog match route", () => {
  beforeEach(() => {
    authenticate.mockReset().mockResolvedValue({ userId: "usr_inventory1" });
    match.mockReset().mockResolvedValue({
      created: true,
      match: { id: "vcm_match1", status: "verified" },
    });
  });

  it("requires a canonical authenticated request body", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ configurationId: "vcf_one" }),
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("creates a governed verified match", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          configurationId: "vcf_12345678901234567890123456789012",
          source: "inventory-review",
        }),
      }),
      context,
    );
    expect(response.status).toBe(201);
    expect(match).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_demo12",
        vehicleId: "veh_vehicle1",
        configurationId: "vcf_12345678901234567890123456789012",
      }),
    );
  });
});
