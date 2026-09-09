import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";

export interface CatalogMatchVehicle {
  id: string;
  organizationId: string;
  locationId: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
}

export interface CatalogMatchConfiguration {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  name?: string;
  readiness: "needs-review" | "in-progress" | "verified" | "pilot-ready" | "not-applicable";
}

export interface VehicleConfigurationMatch {
  id: string;
  organizationId: string;
  vehicleId: string;
  configurationId: string;
  status: "verified";
  source: string;
  evidence: readonly { field: string; vehicleValue: string; catalogValue: string }[];
  matchedBy: string;
}

export interface VehicleConfigurationMatchProvider {
  transaction<Result>(operation: (session: VehicleConfigurationMatchSession) => Promise<Result>): Promise<Result>;
}

export interface VehicleConfigurationMatchSession {
  findVehicle(organizationId: string, vehicleId: string): Promise<CatalogMatchVehicle | undefined>;
  findConfiguration(configurationId: string): Promise<CatalogMatchConfiguration | undefined>;
  listEligibleConfigurations(vehicle: CatalogMatchVehicle): Promise<readonly CatalogMatchConfiguration[]>;
  findVerified(organizationId: string, vehicleId: string): Promise<VehicleConfigurationMatch | undefined>;
  insert(match: VehicleConfigurationMatch): Promise<void>;
}

export class VehicleConfigurationMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VehicleConfigurationMatchError";
  }
}

export class VehicleConfigurationMatchService {
  constructor(private readonly provider: VehicleConfigurationMatchProvider) {}

  candidates(input: { actor: AuthorizationActor; organizationId: string; vehicleId: string }) {
    assertAuthorized(input.actor, { organizationId: input.organizationId, capability: "inventory.read" });
    return this.provider.transaction(async (session) => {
      const vehicle = await session.findVehicle(input.organizationId, input.vehicleId);
      if (!vehicle) throw new VehicleConfigurationMatchError("Vehicle is unavailable.");
      assertAuthorized(input.actor, {
        organizationId: input.organizationId,
        locationId: vehicle.locationId,
        capability: "inventory.read",
      });
      return {
        vehicle,
        existing: await session.findVerified(input.organizationId, input.vehicleId),
        configurations: await session.listEligibleConfigurations(vehicle),
      };
    });
  }

  match(input: {
    actor: AuthorizationActor;
    organizationId: string;
    vehicleId: string;
    configurationId: string;
    source: string;
  }) {
    assertAuthorized(input.actor, { organizationId: input.organizationId, capability: "inventory.update" });
    return this.provider.transaction(async (session) => {
      const existing = await session.findVerified(input.organizationId, input.vehicleId);
      if (existing) {
        if (existing.configurationId !== input.configurationId) {
          throw new VehicleConfigurationMatchError("Vehicle already has a different verified catalog match.");
        }
        return { match: existing, created: false };
      }
      const vehicle = await session.findVehicle(input.organizationId, input.vehicleId);
      if (!vehicle) throw new VehicleConfigurationMatchError("Vehicle is unavailable.");
      assertAuthorized(input.actor, {
        organizationId: input.organizationId,
        locationId: vehicle.locationId,
        capability: "inventory.update",
      });
      const configuration = await session.findConfiguration(input.configurationId);
      if (!configuration || !["verified", "pilot-ready"].includes(configuration.readiness)) {
        throw new VehicleConfigurationMatchError("Catalog configuration is not eligible for verified matching.");
      }
      const evidence = compare(vehicle, configuration);
      if (
        evidence.length < 3 ||
        evidence.some((item) => normalize(item.vehicleValue) !== normalize(item.catalogValue))
      ) {
        throw new VehicleConfigurationMatchError("Vehicle identity does not match the catalog configuration.");
      }
      const match: VehicleConfigurationMatch = {
        id: generateEntityId("vcm"),
        organizationId: input.organizationId,
        vehicleId: vehicle.id,
        configurationId: configuration.id,
        status: "verified",
        source: input.source.trim(),
        evidence,
        matchedBy: input.actor.userId,
      };
      if (!match.source) throw new VehicleConfigurationMatchError("Match source is required.");
      await session.insert(match);
      return { match, created: true };
    });
  }
}

function compare(vehicle: CatalogMatchVehicle, configuration: CatalogMatchConfiguration) {
  const pairs = [
    { field: "year", vehicleValue: String(vehicle.year), catalogValue: String(configuration.year) },
    { field: "make", vehicleValue: vehicle.make, catalogValue: configuration.make },
    { field: "model", vehicleValue: vehicle.model, catalogValue: configuration.model },
  ];
  if (vehicle.trim) pairs.push({ field: "trim", vehicleValue: vehicle.trim, catalogValue: configuration.trim });
  return pairs;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
