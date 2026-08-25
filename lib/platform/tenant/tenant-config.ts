export const tenantVerticals = [
  "automotive",
  "marine",
  "powersports",
  "inventory-sales",
] as const;

export type TenantVertical = (typeof tenantVerticals)[number];

export const tenantFeatureKeys = [
  "crm",
  "inventory",
  "finance",
  "service",
  "reporting",
  "ai",
  "customerPortal",
  "dealerPortal",
] as const;

export type TenantFeatureKey = (typeof tenantFeatureKeys)[number];
export type TenantFeatures = Readonly<Record<TenantFeatureKey, boolean>>;

export interface TenantBrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface TenantBrand {
  organizationName: string;
  productName: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  colors: TenantBrandColors;
  supportEmail?: string;
  supportPhone?: string;
  legalUrl?: string;
  privacyUrl?: string;
}

export interface TenantTerminology {
  item: string;
  itemPlural: string;
  itemIdentifier: string;
  location: string;
  locationPlural: string;
  inventoryUnit: string;
}

export interface TenantConfiguration {
  id: string;
  slug: string;
  vertical: TenantVertical;
  customDomain?: string;
  brand: TenantBrand;
  features: TenantFeatures;
  terminology: TenantTerminology;
}

export interface TenantConfigurationInput {
  id: string;
  slug: string;
  vertical: TenantVertical;
  customDomain?: string;
  brand: Omit<TenantBrand, "colors"> & {
    colors?: Partial<TenantBrandColors>;
  };
  features?: Partial<Record<TenantFeatureKey, boolean>>;
  terminology?: Partial<TenantTerminology>;
}

const defaultColors: TenantBrandColors = {
  primary: "#4f5fe7",
  secondary: "#e9ebf8",
  accent: "#dde2ff",
};

const defaultFeatures: TenantFeatures = {
  crm: true,
  inventory: true,
  finance: true,
  service: false,
  reporting: true,
  ai: true,
  customerPortal: false,
  dealerPortal: false,
};

const terminologyByVertical: Record<TenantVertical, TenantTerminology> = {
  automotive: {
    item: "Vehicle",
    itemPlural: "Vehicles",
    itemIdentifier: "VIN",
    location: "Dealership",
    locationPlural: "Dealerships",
    inventoryUnit: "Inventory Unit",
  },
  marine: {
    item: "Boat",
    itemPlural: "Boats",
    itemIdentifier: "Hull ID",
    location: "Dealer",
    locationPlural: "Dealers",
    inventoryUnit: "Marine Inventory Unit",
  },
  powersports: {
    item: "Unit",
    itemPlural: "Units",
    itemIdentifier: "VIN",
    location: "Dealer",
    locationPlural: "Dealers",
    inventoryUnit: "Inventory Unit",
  },
  "inventory-sales": {
    item: "Item",
    itemPlural: "Items",
    itemIdentifier: "Serial Number",
    location: "Location",
    locationPlural: "Locations",
    inventoryUnit: "Inventory Unit",
  },
};

export class TenantConfigurationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Tenant configuration is invalid.");
    this.name = "TenantConfigurationError";
    this.issues = [...issues];
  }
}

export function resolveTenantConfiguration(
  input: TenantConfigurationInput,
): TenantConfiguration {
  const issues = validateTenantConfigurationInput(input);

  if (issues.length > 0) {
    throw new TenantConfigurationError(issues);
  }

  return {
    id: input.id,
    slug: input.slug,
    vertical: input.vertical,
    ...(input.customDomain ? { customDomain: input.customDomain } : {}),
    brand: {
      ...input.brand,
      colors: {
        ...defaultColors,
        ...input.brand.colors,
      },
    },
    features: {
      ...defaultFeatures,
      ...input.features,
    },
    terminology: {
      ...terminologyByVertical[input.vertical],
      ...input.terminology,
    },
  };
}

export function parseTenantConfiguration(input: unknown): TenantConfiguration {
  if (!isRecord(input)) {
    throw new TenantConfigurationError(["Configuration must be an object."]);
  }

  const issues: string[] = [];
  const id = readRequiredString(input, "id", issues);
  const slug = readRequiredString(input, "slug", issues);
  const verticalValue = readRequiredString(input, "vertical", issues);
  const brandValue = input.brand;

  if (!isTenantVertical(verticalValue)) {
    issues.push("vertical must be a supported vertical.");
  }

  if (!isRecord(brandValue)) {
    issues.push("brand must be an object.");
  }

  if (issues.length > 0 || !isRecord(brandValue)) {
    throw new TenantConfigurationError(issues);
  }

  const organizationName = readRequiredString(
    brandValue,
    "organizationName",
    issues,
  );
  const productName = readRequiredString(brandValue, "productName", issues);
  const colors = parseOptionalStringRecord(brandValue.colors, "brand.colors", issues);
  const features = parseOptionalBooleanRecord(input.features, "features", issues);
  const terminology = parseOptionalStringRecord(
    input.terminology,
    "terminology",
    issues,
  );

  const configurationInput: TenantConfigurationInput = {
    id,
    slug,
    vertical: isTenantVertical(verticalValue) ? verticalValue : "automotive",
    customDomain: readOptionalString(input, "customDomain", issues),
    brand: {
      organizationName,
      productName,
      logoUrl: readOptionalString(brandValue, "logoUrl", issues),
      logoDarkUrl: readOptionalString(brandValue, "logoDarkUrl", issues),
      faviconUrl: readOptionalString(brandValue, "faviconUrl", issues),
      supportEmail: readOptionalString(brandValue, "supportEmail", issues),
      supportPhone: readOptionalString(brandValue, "supportPhone", issues),
      legalUrl: readOptionalString(brandValue, "legalUrl", issues),
      privacyUrl: readOptionalString(brandValue, "privacyUrl", issues),
      colors: pickStringValues<TenantBrandColors>(colors, [
        "primary",
        "secondary",
        "accent",
      ]),
    },
    features: pickBooleanValues<TenantFeatureKey>(features, tenantFeatureKeys),
    terminology: pickStringValues<TenantTerminology>(terminology, [
      "item",
      "itemPlural",
      "itemIdentifier",
      "location",
      "locationPlural",
      "inventoryUnit",
    ]),
  };

  if (issues.length > 0) {
    throw new TenantConfigurationError(issues);
  }

  return resolveTenantConfiguration(configurationInput);
}

export function isFeatureEnabled(
  tenant: TenantConfiguration,
  feature: TenantFeatureKey,
): boolean {
  return tenant.features[feature];
}

function validateTenantConfigurationInput(
  input: TenantConfigurationInput,
): string[] {
  const issues: string[] = [];

  if (!/^org_[a-z0-9][a-z0-9_-]{5,63}$/.test(input.id)) {
    issues.push("id must be an immutable organization ID beginning with org_.");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    issues.push("slug must contain lowercase letters, numbers, and single hyphens.");
  }

  if (!isTenantVertical(input.vertical)) {
    issues.push("vertical must be a supported vertical.");
  }

  if (input.customDomain && !isValidHostname(input.customDomain)) {
    issues.push("customDomain must be a valid hostname without a protocol or path.");
  }

  if (!input.brand.organizationName.trim()) {
    issues.push("brand.organizationName is required.");
  }

  if (!input.brand.productName.trim()) {
    issues.push("brand.productName is required.");
  }

  for (const [name, value] of [
    ["logoUrl", input.brand.logoUrl],
    ["logoDarkUrl", input.brand.logoDarkUrl],
    ["faviconUrl", input.brand.faviconUrl],
  ] as const) {
    if (value !== undefined && !isValidHostedAssetUrl(value)) {
      issues.push(`brand.${name} must be an HTTPS URL without embedded credentials.`);
    }
  }

  for (const [name, value] of Object.entries(input.brand.colors ?? {})) {
    if (value !== undefined && !isValidHexColor(value)) {
      issues.push(`brand.colors.${name} must be a six-digit hexadecimal color.`);
    }
  }

  for (const [name, value] of Object.entries(input.terminology ?? {})) {
    if (value !== undefined && !value.trim()) {
      issues.push(`terminology.${name} cannot be empty.`);
    }
  }

  return issues;
}

function isTenantVertical(value: string): value is TenantVertical {
  return tenantVerticals.some((vertical) => vertical === value);
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function isValidHostedAssetUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isValidHostname(value: string): boolean {
  if (value.length > 253 || value.includes("://") || value.includes("/")) {
    return false;
  }

  return value
    .split(".")
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(
  source: Record<string, unknown>,
  key: string,
  issues: string[],
): string {
  const value = source[key];

  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${key} must be a non-empty string.`);
    return "";
  }

  return value;
}

function readOptionalString(
  source: Record<string, unknown>,
  key: string,
  issues: string[],
): string | undefined {
  const value = source[key];

  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${key} must be a non-empty string when provided.`);
    return undefined;
  }

  return value;
}

function parseOptionalStringRecord(
  value: unknown,
  label: string,
  issues: string[],
): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    issues.push(`${label} must be an object when provided.`);
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      issues.push(`${label}.${key} must be a string.`);
    } else {
      result[key] = item;
    }
  }
  return result;
}

function parseOptionalBooleanRecord(
  value: unknown,
  label: string,
  issues: string[],
): Record<string, boolean> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    issues.push(`${label} must be an object when provided.`);
    return {};
  }

  const result: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "boolean") {
      issues.push(`${label}.${key} must be a boolean.`);
    } else {
      result[key] = item;
    }
  }
  return result;
}

function pickStringValues<T extends object>(
  source: Record<string, string>,
  keys: readonly (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    const value = source[String(key)];
    if (value !== undefined) {
      result[key] = value as T[typeof key];
    }
  }
  return result;
}

function pickBooleanValues<Key extends string>(
  source: Record<string, boolean>,
  keys: readonly Key[],
): Partial<Record<Key, boolean>> {
  const result: Partial<Record<Key, boolean>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
}
