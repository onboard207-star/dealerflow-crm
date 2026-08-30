import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),"utf8");

describe("public marketing boundary",()=>{
  it("keeps authenticated organization and API routes out of robots discovery",()=>{const source=read("app/robots.ts");expect(source).toContain('disallow:["/organizations/","/api/"');});
  it("does not transmit demo requests before commercial persistence exists",()=>{const source=read("components/marketing/DemoRequestForm.tsx");expect(source).not.toContain("fetch(");expect(source).not.toContain("action=");expect(source).toContain("has not been transmitted");});
  it("does not claim unverified security certifications",()=>{const source=read("app/security/page.tsx");expect(source).toContain("does not currently claim SOC 2");});
});
