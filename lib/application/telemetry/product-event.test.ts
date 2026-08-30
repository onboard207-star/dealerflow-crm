import { describe, expect, it } from "vitest";
import { countsTowardHumanAdoption, ProductTelemetryValidationError, validateProductUsageEvent, type ProductUsageEventInput } from "./product-event";

const event: ProductUsageEventInput = { organizationId:"org_dealerflow",userId:"usr_salesperson",eventName:"task.completed",actorType:"dealer-user",dataClass:"pilot",workspace:"my-day",feature:"tasks",action:"complete",release:"1f70625",deviceClass:"mobile",idempotencyKey:"task:tsk_123:completed",occurredAt:"2026-08-30T20:00:00Z",attributes:{"task-priority":"high"} };

describe("governed product telemetry",()=>{
  it("accepts bounded identifiers without customer content",()=>expect(validateProductUsageEvent(event)).toMatchObject({eventName:"task.completed",workspace:"my-day"}));
  it.each(["messageBody","customerEmail","rawNote","accessToken","creditScore"])("rejects sensitive attribute %s",key=>expect(()=>validateProductUsageEvent({...event,attributes:{[key]:"sensitive"}})).toThrow(ProductTelemetryValidationError));
  it("excludes demo, internal, automation, and synthetic activity from human adoption",()=>{expect(countsTowardHumanAdoption(event)).toBe(true);for(const actorType of ["dealerflow-staff","automation","synthetic"] as const)expect(countsTowardHumanAdoption({...event,actorType})).toBe(false);expect(countsTowardHumanAdoption({...event,dataClass:"demo"})).toBe(false)});
});
