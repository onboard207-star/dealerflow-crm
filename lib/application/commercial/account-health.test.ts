import { describe, expect, it } from "vitest";
import { assessAccountHealth } from "./account-health";

const healthy = { unresolvedIncidents: [], criticalIntegrations: [{ name: "DMS", health: "healthy" as const }], billingStatus: "current" as const, adoptionStatus: "healthy" as const, sponsorEngagement: "engaged" as const, pilotProgress: "on_track" as const };

describe("assessAccountHealth", () => {
  it("is green only when every required signal is healthy", () => expect(assessAccountHealth(healthy)).toEqual({ status: "green", reasons: [] }));
  it("never averages away an unresolved P1", () => expect(assessAccountHealth({ ...healthy, unresolvedIncidents: [{ priority: "p1", reference: "INC-42" }] }).status).toBe("red"));
  it("treats a failed critical integration as red", () => expect(assessAccountHealth({ ...healthy, criticalIntegrations: [{ name: "DMS", health: "failed" }] }).status).toBe("red"));
  it("reports incomplete inputs instead of inventing health", () => {
    const result = assessAccountHealth({ unresolvedIncidents: [], criticalIntegrations: [] });
    expect(result.status).toBe("yellow");
    expect(result.reasons).toContainEqual(expect.objectContaining({ code: "assessment.incomplete" }));
  });
});
