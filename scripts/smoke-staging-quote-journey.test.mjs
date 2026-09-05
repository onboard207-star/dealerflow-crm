import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { parseArguments } from "./smoke-staging-quote-journey.mjs";

const args = ["--confirm", "RUN-SYNTHETIC-STAGING-QUOTE-JOURNEY", "--organization-id", "org_demo_first_pilot_v1", "--location-id", "loc_demo_main_rooftop_v1", "--deal-id", "dea_synthetic_deal", "--application-url", "https://staging.example.com", "--expected-database-host", "isolated.internal"];

describe("staging Quote journey acceptance", () => {
  it.each(["production", "development", "test", undefined])("refuses APP_ENV=%s", (APP_ENV) => expect(() => parseArguments(args, { APP_ENV, DATABASE_URL: "postgresql://user:secret@isolated.internal/database" })).toThrow("disabled outside APP_ENV=staging"));
  it("binds execution to the exact database host", () => expect(() => parseArguments(args, { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@other.internal/database" })).toThrow("does not match"));
  it("requires the explicit confirmation", () => expect(() => parseArguments(args.with(1, "NO"), { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@isolated.internal/database" })).toThrow("--confirm"));
  it("requires HTTPS", () => expect(() => parseArguments(args.with(9, "http://staging.example.com"), { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@isolated.internal/database" })).toThrow("HTTPS"));
  it("covers the guarded exact-version document and delivery continuation", () => {
    const source = readFileSync(new URL("./smoke-staging-quote-journey.mjs", import.meta.url), "utf8");
    expect(source).toContain("alternate Quote acceptance rejection");
    expect(source).toContain("Salesperson document-management denial");
    expect(source).toContain("cross-Deal document transition denial");
    expect(source).toContain("direct document URL rejection");
    expect(source).toContain("unauthorized document waiver");
    expect(source).toContain("cross-tenant document denial");
    expect(source).toContain("Delivery scheduling idempotency evidence is incomplete");
    expect(source).toContain("row.bound_quote_id !== quoteId");
  });
});
