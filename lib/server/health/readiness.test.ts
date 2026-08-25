import { describe, expect, it, vi } from "vitest";

import { evaluateReadiness } from "./readiness";

describe("evaluateReadiness", () => {
  it("reports ready only when every required dependency succeeds", async () => {
    const result = await evaluateReadiness([
      { name: "database", check: vi.fn().mockResolvedValue(undefined) },
      { name: "configuration", check: vi.fn().mockResolvedValue(undefined) },
    ]);

    expect(result).toEqual({
      ready: true,
      checks: [
        { name: "database", status: "ready" },
        { name: "configuration", status: "ready" },
      ],
    });
  });

  it("does not expose dependency error details", async () => {
    const result = await evaluateReadiness([
      {
        name: "database",
        check: vi.fn().mockRejectedValue(new Error("secret database details")),
      },
    ]);

    expect(result).toEqual({
      ready: false,
      checks: [{ name: "database", status: "unavailable" }],
    });
    expect(JSON.stringify(result)).not.toContain("secret database details");
  });
});
