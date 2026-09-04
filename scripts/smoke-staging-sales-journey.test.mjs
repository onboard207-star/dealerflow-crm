import { describe, expect, it } from "vitest";

import { parseArguments } from "./smoke-staging-sales-journey.mjs";

const future = new Date(Date.now() + 86_400_000).toISOString();
const later = new Date(Date.now() + 90_000_000).toISOString();
const args = ["--confirm", "RUN-SYNTHETIC-STAGING-SALES-JOURNEY", "--actor-email", "synthetic+sales@example.com", "--customer-email", "journey@example.invalid", "--organization-id", "org_demo_first_pilot_v1", "--location-id", "loc_demo_main_rooftop_v1", "--application-url", "https://staging.example.com", "--expected-database-host", "isolated.internal", "--starts-at", future, "--ends-at", later];

describe("staging sales journey smoke", () => {
  it.each(["production", "development", "test", undefined])("refuses APP_ENV=%s", (APP_ENV) => expect(() => parseArguments(args, { APP_ENV, DATABASE_URL: "postgresql://user:secret@isolated.internal/database" })).toThrow("disabled outside APP_ENV=staging"));
  it("binds execution to the exact database host", () => expect(() => parseArguments(args, { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@other.internal/database" })).toThrow("does not match"));
  it("requires a reserved synthetic customer", () => expect(() => parseArguments(args.with(5, "real@example.com"), { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@isolated.internal/database" })).toThrow("reserved synthetic email"));
  it("requires an explicit future appointment time", () => {
    const past = args.with(15, "2020-01-01T12:00:00.000Z").with(17, "2020-01-01T13:00:00.000Z");
    expect(() => parseArguments(past, { APP_ENV: "staging", DATABASE_URL: "postgresql://user:secret@isolated.internal/database" })).toThrow("future");
  });
});
