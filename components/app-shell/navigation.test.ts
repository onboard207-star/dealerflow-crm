import { describe, expect, it } from "vitest";
import { createOrganizationNavigation } from "./navigation";

describe("organization navigation", () => {
  it("shows Calendar only when appointment access is granted", () => {
    const allowed = createOrganizationNavigation("org_dealerflow", ["appointment.read"])[0]!.items;
    const denied = createOrganizationNavigation("org_dealerflow", ["customer.read"])[0]!.items;
    expect(allowed).toContainEqual(expect.objectContaining({ label: "Calendar", href: "/organizations/org_dealerflow/calendar" }));
    expect(denied.some((item) => item.label === "Calendar")).toBe(false);
  });
});
