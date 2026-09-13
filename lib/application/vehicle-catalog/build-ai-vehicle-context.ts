import type { CatalogConfiguration } from "./catalog-domain";

export interface AIVehicleContext {
  identity: { configurationId: string; stableKey: string; make: string; model: string; year: number; trim: string; configuration: string };
  readiness: string;
  core: Readonly<Record<string, string | number>>;
  specifications: readonly { name: string; value?: string; unit?: string; readiness: string }[];
  features: readonly string[];
  packages: readonly string[];
}

export function buildAIVehicleContext(configuration: CatalogConfiguration): AIVehicleContext {
  const core = Object.fromEntries(Object.entries({
    drivetrain: configuration.drivetrain, powertrain: configuration.powertrain, engine: configuration.engine,
    transmission: configuration.transmission, bodyStyle: configuration.bodyStyle, seatCount: configuration.seatCount,
  }).filter((entry): entry is [string, string | number] => entry[1] !== undefined));
  return {
    identity: { configurationId: configuration.id, stableKey: configuration.stableKey, make: configuration.make.name,
      model: configuration.model.name, year: configuration.modelYear.year, trim: configuration.trim.name, configuration: configuration.name },
    readiness: configuration.readiness,
    core,
    specifications: configuration.attributes.filter((item) => item.kind === "specification" && item.relationship !== "excluded")
      .map((item) => ({ name: item.name, ...(item.value ? { value: item.value } : {}), ...(item.unit ? { unit: item.unit } : {}), readiness: item.readiness })),
    features: configuration.attributes.filter((item) => item.kind === "feature" && item.relationship !== "excluded").map((item) => item.name),
    packages: configuration.attributes.filter((item) => item.kind === "package" && item.relationship !== "excluded").map((item) => item.name),
  };
}
