import { describe, expect, it } from "vitest";
import nextConfig, { createContentSecurityPolicy } from "./next.config";

describe("production Next.js configuration", () => {
  it("builds a portable standalone runtime without framework disclosure", () => {
    expect(nextConfig.output).toBe("standalone");
    expect(nextConfig.poweredByHeader).toBe(false);
  });
  it("applies baseline browser security headers to every route", async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(rules?.[0]?.headers.map((header) => [header.key, header.value]));
    expect(rules?.[0]?.source).toBe("/:path*");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
  it("limits production browser sources while allowing validated HTTPS tenant images",()=>{const policy=createContentSecurityPolicy("production");expect(policy).toContain("default-src 'self'");expect(policy).toContain("img-src 'self' data: blob: https:");expect(policy).toContain("connect-src 'self' https://*.r2.cloudflarestorage.com");expect(policy).toContain("form-action 'self'");expect(policy).toContain("upgrade-insecure-requests");expect(policy).not.toContain("unsafe-eval");expect(createContentSecurityPolicy("development")).toContain("unsafe-eval");});
});
