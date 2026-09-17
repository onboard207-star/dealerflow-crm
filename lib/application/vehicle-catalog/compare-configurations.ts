import type { CatalogAttribute, CatalogConfiguration, VehicleCatalogRepository } from "./catalog-domain";

export type ComparisonFactState = "verified" | "incomplete" | "unavailable";
export interface VehicleComparisonFact {
  key: string;
  label: string;
  values: readonly { configurationId: string; value?: string; state: ComparisonFactState }[];
}
export interface VehicleConfigurationComparison {
  configurations: readonly CatalogConfiguration[];
  facts: readonly VehicleComparisonFact[];
}

const coreFacts = [
  ["msrp", "MSRP"], ["engine", "Engine"], ["powertrain", "Powertrain"], ["transmission", "Transmission"],
  ["drivetrain", "Drivetrain"], ["horsepower", "Horsepower"], ["torque", "Torque"], ["mpg", "Fuel economy"],
  ["mpge", "MPGe"], ["ev-range", "EV range"], ["battery", "Battery"], ["charging", "Charging"],
  ["connector", "Charging connector"], ["acceleration", "Acceleration"],
  ["towing", "Towing"], ["payload", "Payload"], ["seating", "Seating"], ["cargo", "Cargo"],
  ["passenger-volume", "Passenger volume"], ["dimensions", "Dimensions"], ["ground-clearance", "Ground clearance"], ["features", "Features"],
  ["packages", "Packages / options"], ["warranty", "Warranty"],
] as const;

export class VehicleConfigurationComparisonService {
  constructor(private readonly repository: VehicleCatalogRepository) {}

  async compare(configurationIds: readonly string[]): Promise<VehicleConfigurationComparison> {
    const unique = [...new Set(configurationIds)];
    if (unique.length < 2 || unique.length > 3) throw new Error("Compare two or three distinct configurations.");
    const configurations = await Promise.all(unique.map((id) => this.repository.getConfiguration(id)));
    if (configurations.some((value) => !value)) throw new Error("A selected catalog configuration is unavailable.");
    const resolved = configurations.filter((value): value is CatalogConfiguration => Boolean(value));
    return { configurations: resolved, facts: coreFacts.map(([key, label]) => fact(key, label, resolved)) };
  }
}

function fact(key: string, label: string, configurations: readonly CatalogConfiguration[]): VehicleComparisonFact {
  return {
    key, label,
    values: configurations.map((configuration) => {
      const core = coreValue(configuration, key);
      const attribute = core ? undefined : attributeValue(configuration.attributes, key);
      const value = core ?? attribute?.value;
      return { configurationId: configuration.id, ...(value ? { value } : {}), state: core ? state(configuration) : attribute?.state ?? "unavailable" };
    }),
  };
}

function coreValue(configuration: CatalogConfiguration, key: string): string | undefined {
  if (key === "engine") return configuration.engine;
  if (key === "powertrain") return configuration.powertrain;
  if (key === "transmission") return configuration.transmission;
  if (key === "drivetrain") return configuration.drivetrain;
  if (key === "seating") return configuration.seatCount === undefined ? undefined : String(configuration.seatCount);
  return undefined;
}

function attributeValue(attributes: readonly CatalogAttribute[], key: string) {
  const matching = attributes.filter((attribute) => matches(attribute, key) && attribute.relationship !== "excluded" && (attribute.kind !== "specification" || Boolean(attribute.value)));
  if (!matching.length) return undefined;
  return {
    value: matching.map((attribute) => attribute.value ? `${attribute.name}: ${attribute.value}${attribute.unit ? ` ${attribute.unit}` : ""}` : attribute.name).join(", "),
    state: matching.every((attribute) => attribute.readiness === "verified" || attribute.readiness === "pilot-ready") ? "verified" as const : "incomplete" as const,
  };
}

function matches(attribute: CatalogAttribute, key: string): boolean {
  const name = `${attribute.stableKey} ${attribute.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (key === "features") return attribute.kind === "feature";
  if (key === "packages") return attribute.kind === "package";
  if (key === "msrp") return /msrp|price/.test(name);
  if (key === "mpg") return !name.includes("mpge") && /(^|-)mpg($|-)|fuel-economy/.test(name);
  if (key === "mpge") return name.includes("mpge");
  if (key === "ev-range") return /ev-range|electric-range|epa-range/.test(name);
  if (key === "connector") return /connector|nacs|j1772|ccs/.test(name);
  if (key === "charging") return /charging|charge-time|charge-rate|onboard-ac|dc-fast/.test(name) && !matches(attribute, "connector");
  return name.includes(key);
}

function state(configuration: CatalogConfiguration): ComparisonFactState {
  return configuration.readiness === "verified" || configuration.readiness === "pilot-ready" ? "verified" : "incomplete";
}
