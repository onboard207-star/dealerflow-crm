import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),"utf8");

describe("public marketing boundary",()=>{
  it("keeps authenticated organization and API routes out of robots discovery",()=>{const source=read("app/robots.ts");expect(source).toContain('disallow:["/organizations/","/api/"');});
  it("submits demo requests only to the governed pre-tenant intake",()=>{const source=read("components/marketing/DemoRequestForm.tsx");expect(source).toContain('fetch("/api/commercial/demo-requests"');expect(source).toContain('"idempotency-key"');expect(source).not.toContain("/api/organizations/");});
  it("keeps commercial prospects outside dealership Lead and Customer authority",()=>{const migration=read("drizzle/0058_commercial_demo_requests.sql");const intake=read("lib/server/commercial/demo-request-intake.ts");expect(migration).toContain('CREATE TABLE "commercial_demo_requests"');expect(migration).toContain('CREATE TABLE "commercial_demo_request_events"');expect(migration).not.toContain('REFERENCES "organizations"');expect(intake).not.toContain("INSERT INTO leads");expect(intake).not.toContain("INSERT INTO customers");expect(intake).toContain("network_count");expect(intake).toContain("deduplication_key");expect(intake).toContain("commercial-demo-request");});
  it("does not claim unverified security certifications",()=>{const source=read("app/security/page.tsx");expect(source).toContain("does not currently claim SOC 2");});
});
