import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import { PackPolicyIntegrityError, PackPolicyService, resolveEffectivePackPolicy, type PackPolicy, type PackPolicyProvider, type PackPolicySession } from "./manage-pack-policy";

const policy = (id: string, amount?: number, locationId?: string, enabled = true): PackPolicy => ({ id, organizationId: "org_main", ...(locationId ? { locationId } : {}), enabled, ...(amount !== undefined ? { packAmountCents: amount } : {}), version: 1, updatedAt: "2026-09-02T12:00:00.000Z" });

describe("resolveEffectivePackPolicy", () => {
  it("uses a location override before the organization default", () => expect(resolveEffectivePackPolicy({ organizationDefault: policy("qpk_org", 40000), locationOverride: policy("qpk_location", 65000, "loc_main") })).toEqual({ amountCents: 65000, source: "location-override", policyId: "qpk_location" }));
  it("falls back to the organization default", () => expect(resolveEffectivePackPolicy({ organizationDefault: policy("qpk_org", 40000), locationOverride: null })).toEqual({ amountCents: 40000, source: "organization-default", policyId: "qpk_org" }));
  it("treats a disabled location override as an explicit zero policy", () => expect(resolveEffectivePackPolicy({ organizationDefault: policy("qpk_org", 40000), locationOverride: policy("qpk_off", undefined, "loc_main", false) })).toEqual({ amountCents: 0, source: "no-enabled-policy" }));
  it("allows zero with no enabled policy and fails closed for malformed enabled policy", () => {
    expect(resolveEffectivePackPolicy({ organizationDefault: null, locationOverride: null })).toEqual({ amountCents: 0, source: "no-enabled-policy" });
    expect(() => resolveEffectivePackPolicy({ organizationDefault: policy("qpk_bad"), locationOverride: null })).toThrow(PackPolicyIntegrityError);
  });
});

class MemoryProvider implements PackPolicyProvider,PackPolicySession{current:PackPolicy|null=null;async transaction<Result>(operation:(session:PackPolicySession)=>Promise<Result>){return operation(this)}async getScope(){return this.current}async save(_context:RequestContext,input:{id:string;enabled:boolean;packAmountCents?:number;expectedVersion?:number}){this.current={id:input.id,organizationId:"org_main",enabled:input.enabled,...(input.packAmountCents!==undefined?{packAmountCents:input.packAmountCents}:{}),version:(input.expectedVersion??0)+1,updatedAt:"2026-09-02T12:00:00.000Z"};return this.current}}
const actor=(caps:AuthorizationActor["memberships"][number]["capabilities"]=["quote.pack.configure"],locations:readonly string[]|"all"="all"):AuthorizationActor=>({userId:"usr_controller",memberships:[{organizationId:"org_main",locationIds:locations,capabilities:caps}]});
describe("PackPolicyService",()=>{it("rejects users without pack authority",async()=>{await expect(new PackPolicyService(new MemoryProvider()).save({actor:actor([]),organizationId:"org_main",correlationId:"req_pack",enabled:false})).rejects.toBeInstanceOf(AuthorizationError)});it("enforces location scope and enabled policy amount",async()=>{await expect(new PackPolicyService(new MemoryProvider()).save({actor:actor(["quote.pack.configure"],["loc_other"]),organizationId:"org_main",locationId:"loc_main",correlationId:"req_pack",enabled:false})).rejects.toBeInstanceOf(AuthorizationError);await expect(new PackPolicyService(new MemoryProvider()).save({actor:actor(),organizationId:"org_main",correlationId:"req_pack",enabled:true})).rejects.toThrow("invalid")})});
