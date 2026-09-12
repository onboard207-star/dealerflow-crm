import { describe, expect, it } from "vitest";

import { resolveDatabaseSslMode } from "./provision-tenant.mjs";

describe("tenant provisioner database TLS", () => {
  it("defaults staging and production to certificate verification", () => {
    expect(resolveDatabaseSslMode({ APP_ENV: "staging" })).toBe("verify-full");
    expect(resolveDatabaseSslMode({ APP_ENV: "production" })).toBe("verify-full");
  });

  it("accepts the explicit Render private-network mode", () => {
    expect(resolveDatabaseSslMode({
      APP_ENV: "staging",
      DATABASE_SSL_MODE: "disable",
    })).toBe("disable");
  });

  it("rejects unsupported TLS modes", () => {
    expect(() => resolveDatabaseSslMode({
      APP_ENV: "staging",
      DATABASE_SSL_MODE: "require",
    })).toThrow("DATABASE_SSL_MODE must be disable or verify-full");
  });
});
