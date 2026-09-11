import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Better Auth reverse-proxy boundary", () => {
  it("uses Render's overwritten client address header for rate limiting", () => {
    const source = readFileSync("lib/server/auth/better-auth.ts", "utf8");
    expect(source).toContain('ipAddressHeaders: ["x-forwarded-for"]');
    expect(source).not.toContain("disableIpTracking: true");
    expect(source).not.toContain("rateLimit: { enabled: false");
  });
});
