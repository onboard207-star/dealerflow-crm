import { describe, expect, it } from "vitest";

import { capabilities } from "@/lib/platform/auth";
import { featureEntitlementRegistry, featureForCapability, isCapabilityEntitled } from "./feature-entitlements";

describe("feature entitlement registry", () => {
  it("maps every product capability at most once", () => {
    const mapped = featureEntitlementRegistry.flatMap((feature) => feature.capabilities);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(mapped.every((capability) => capabilities.includes(capability))).toBe(true);
  });

  it("fails closed when the owning module is disabled", () => {
    expect(featureForCapability("communication.send")).toBe("crm");
    expect(isCapabilityEntitled("communication.send", { crm: false })).toBe(false);
    expect(isCapabilityEntitled("organization.configure", { crm: false })).toBe(true);
  });
});

