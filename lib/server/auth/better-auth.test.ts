import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Better Auth runtime", () => {
  it("uses the database-capable entry point for a direct PostgreSQL pool", () => {
    const source = readFileSync(new URL("./better-auth.ts", import.meta.url), "utf8");

    expect(source).toContain('from "better-auth"');
    expect(source).not.toContain('from "better-auth/minimal"');
  });
});
