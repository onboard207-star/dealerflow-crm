import { describe, expect, it } from "vitest";
import { resolveReleaseInfo } from "./release-info";

describe("resolveReleaseInfo", () => {
  it("exposes only bounded non-secret deployment identity", () => {
    expect(resolveReleaseInfo({ APP_ENV: "staging", RENDER_GIT_COMMIT: "985D040D09538A6DD95792B95E2708763C0A6AA6", DEALERFLOW_DEPLOYED_AT: "2026-08-30T01:24:37Z" })).toEqual({
      environment: "staging",
      commitSha: "985d040d09538a6dd95792b95e2708763c0a6aa6",
      deployedAt: "2026-08-30T01:24:37.000Z",
    });
  });

  it("does not echo malformed environment data", () => {
    expect(resolveReleaseInfo({ APP_ENV: "prod-secret", RENDER_GIT_COMMIT: "$(secret)", DEALERFLOW_DEPLOYED_AT: "invalid" })).toEqual({ environment: "development", commitSha: "unknown", deployedAt: "unknown" });
  });
});

