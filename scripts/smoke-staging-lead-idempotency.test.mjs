import { describe, expect, it } from "vitest";
import { parseArguments } from "./smoke-staging-lead-idempotency.mjs";

const args=["--confirm","RUN-SYNTHETIC-STAGING-LEAD-IDEMPOTENCY","--actor-email","synthetic+sales@example.com","--customer-email","retry@example.invalid","--organization-id","org_demo_first_pilot_v1","--location-id","loc_demo_main_rooftop_v1","--application-url","https://staging.example.com","--expected-database-host","isolated.internal"];
describe("staging lead idempotency smoke",()=>{
  it.each(["production","development","test",undefined])("refuses APP_ENV=%s",APP_ENV=>expect(()=>parseArguments(args,{APP_ENV,DATABASE_URL:"postgresql://user:secret@isolated.internal/database"})).toThrow("disabled outside APP_ENV=staging"));
  it("binds execution to the expected database host",()=>expect(()=>parseArguments(args,{APP_ENV:"staging",DATABASE_URL:"postgresql://user:secret@other.internal/database"})).toThrow("does not match"));
  it("requires reserved synthetic customer identity",()=>expect(()=>parseArguments(args.with(5,"real@example.com"),{APP_ENV:"staging",DATABASE_URL:"postgresql://user:secret@isolated.internal/database"})).toThrow("reserved synthetic email"));
});
