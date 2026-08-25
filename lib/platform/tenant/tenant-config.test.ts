import { describe, expect, it } from "vitest";

import {
  TenantConfigurationError,
  isFeatureEnabled,
  parseTenantConfiguration,
  resolveTenantConfiguration,
  type TenantConfigurationInput,
} from "./tenant-config";

const automotiveTenant: TenantConfigurationInput = {
  id: "org_dealerflow_demo",
  slug: "dealerflow-demo",
  vertical: "automotive",
  customDomain: "crm.exampledealer.com",
  brand: {
    organizationName: "Example Dealer Group",
    productName: "Example Drive",
    colors: { primary: "#123456" },
  },
};

describe("resolveTenantConfiguration", () => {
  it("applies vertical terminology, feature defaults, and brand defaults", () => {
    const tenant = resolveTenantConfiguration(automotiveTenant);

    expect(tenant.terminology.item).toBe("Vehicle");
    expect(tenant.terminology.itemIdentifier).toBe("VIN");
    expect(tenant.brand.colors.primary).toBe("#123456");
    expect(tenant.brand.colors.accent).toBe("#dde2ff");
    expect(isFeatureEnabled(tenant, "crm")).toBe(true);
    expect(isFeatureEnabled(tenant, "customerPortal")).toBe(false);
  });

  it("supports vertical terminology and tenant-specific overrides", () => {
    const tenant = resolveTenantConfiguration({
      ...automotiveTenant,
      id: "org_marine_demo",
      slug: "marine-demo",
      vertical: "marine",
      terminology: { location: "Marina" },
      features: { service: true, finance: false },
    });

    expect(tenant.terminology.item).toBe("Boat");
    expect(tenant.terminology.itemIdentifier).toBe("Hull ID");
    expect(tenant.terminology.location).toBe("Marina");
    expect(tenant.features.service).toBe(true);
    expect(tenant.features.finance).toBe(false);
  });

  it("preserves credential-free HTTPS brand assets", () => {
    const tenant = resolveTenantConfiguration({
      ...automotiveTenant,
      brand: {
        ...automotiveTenant.brand,
        logoUrl: "https://assets.example.com/dealer/logo.png",
        logoDarkUrl: "https://assets.example.com/dealer/logo-dark.png",
        faviconUrl: "https://assets.example.com/dealer/favicon.png",
      },
    });

    expect(tenant.brand).toMatchObject({
      logoUrl: "https://assets.example.com/dealer/logo.png",
      logoDarkUrl: "https://assets.example.com/dealer/logo-dark.png",
      faviconUrl: "https://assets.example.com/dealer/favicon.png",
    });
  });

  it("does not share mutable configuration between tenants", () => {
    const first = resolveTenantConfiguration(automotiveTenant);
    const second = resolveTenantConfiguration({
      ...automotiveTenant,
      id: "org_second_demo",
      slug: "second-demo",
      features: { inventory: false },
    });

    expect(first.features.inventory).toBe(true);
    expect(second.features.inventory).toBe(false);
    expect(first.features).not.toBe(second.features);
    expect(first.terminology).not.toBe(second.terminology);
  });

  it.each([
    ["mutable display name as ID", { ...automotiveTenant, id: "Example Dealer" }],
    ["invalid slug", { ...automotiveTenant, slug: "Example Dealer" }],
    [
      "domain with a protocol",
      { ...automotiveTenant, customDomain: "https://exampledealer.com" },
    ],
    [
      "unsafe color value",
      {
        ...automotiveTenant,
        brand: { ...automotiveTenant.brand, colors: { primary: "blue" } },
      },
    ],
    [
      "insecure hosted brand asset",
      {
        ...automotiveTenant,
        brand: { ...automotiveTenant.brand, logoUrl: "http://assets.example.com/logo.svg" },
      },
    ],
    [
      "credential-bearing hosted brand asset",
      {
        ...automotiveTenant,
        brand: { ...automotiveTenant.brand, faviconUrl: "https://user:secret@assets.example.com/icon.png" },
      },
    ],
  ])("rejects %s", (_name, input) => {
    expect(() => resolveTenantConfiguration(input)).toThrow(
      TenantConfigurationError,
    );
  });
});

describe("parseTenantConfiguration", () => {
  it("validates unknown external configuration before resolving it", () => {
    const tenant = parseTenantConfiguration({
      ...automotiveTenant,
      features: { service: true },
      terminology: { item: "Automobile" },
    });

    expect(tenant.features.service).toBe(true);
    expect(tenant.terminology.item).toBe("Automobile");
  });

  it("rejects malformed external feature values", () => {
    expect(() =>
      parseTenantConfiguration({
        ...automotiveTenant,
        features: { inventory: "yes" },
      }),
    ).toThrow(TenantConfigurationError);
  });

  it("does not include unknown feature or terminology keys", () => {
    const tenant = parseTenantConfiguration({
      ...automotiveTenant,
      features: { crm: true, hiddenFeature: true },
      terminology: { item: "Vehicle", secretLabel: "ignored" },
    });

    expect(Object.keys(tenant.features)).not.toContain("hiddenFeature");
    expect(Object.keys(tenant.terminology)).not.toContain("secretLabel");
  });
});
