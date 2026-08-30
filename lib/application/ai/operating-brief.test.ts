import { describe, expect, it } from "vitest";
import { buildOperatingBrief } from "./operating-brief";

const profile = { key:"my-work", label:"My Work", eyebrow:"Sales workspace", question:"What next?", audience:"individual", roleKeys:["salesperson"], requiredCapability:"lead.read", moduleAvailable:true } as const;
const model = { priorities:[{ id:"task:tsk_one", label:"Call Alex", detail:"Due now", href:"/customers/cus_one", tone:"danger" as const }], today:[], exceptions:[], metrics:[{ label:"Active Leads", value:4, definition:"Assigned to you.", href:"/leads" },{ label:"Deals Awaiting Approval", value:9, definition:"Pending Deals.", href:"/deals" }], generatedAt:"2026-08-29T12:00:00.000Z" };

describe("buildOperatingBrief",()=>{
  it("creates a structured role brief with source links",()=>{const brief=buildOperatingBrief({capabilities:["lead.read","task.read"],model,profile});expect(brief.title).toBe("Morning Brief");expect(brief.primaryRecommendation).toMatchObject({kind:"recommendation",href:"/customers/cus_one"});expect(brief.facts).toEqual([expect.objectContaining({title:"4 Active Leads",kind:"fact"})]);});
  it("removes facts and recommendations outside the resolved capability set",()=>{const brief=buildOperatingBrief({capabilities:["deal.read"],model,profile});expect(brief.facts.map(item=>item.title)).toEqual(["9 Deals Awaiting Approval"]);expect(brief.facts.some(item=>item.title.includes("Active Leads"))).toBe(false);expect(brief.primaryRecommendation).toBeUndefined();});
});
