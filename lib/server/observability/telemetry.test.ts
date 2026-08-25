import { describe,expect,it,vi } from "vitest";
import { StructuredTelemetry,resolveCorrelationId,type TelemetrySink } from "./telemetry";

describe("StructuredTelemetry",()=>{
  it("emits stable JSON while removing sensitive attribute names",()=>{const write=vi.fn<TelemetrySink["write"]>();new StructuredTelemetry({write}).emit({code:"email.job.failed",severity:"error",correlationId:"req_12345678",timestamp:"2026-08-24T12:00:00.000Z",attributes:{failed:2,email:"person@example.com",accessToken:"secret",destination:"+15551234567"}});const payload=JSON.parse(write.mock.calls[0]?.[0]??"{}");expect(payload).toMatchObject({code:"email.job.failed",severity:"error",correlationId:"req_12345678",attributes:{failed:2}});expect(write.mock.calls[0]?.[0]).not.toContain("person@example.com");expect(write.mock.calls[0]?.[0]).not.toContain("secret");});
  it("accepts only bounded request correlation identifiers",()=>{expect(resolveCorrelationId(new Request("https://example.com",{headers:{"x-correlation-id":"req_external_12345"}}))).toBe("req_external_12345");expect(resolveCorrelationId(new Request("https://example.com",{headers:{"x-correlation-id":"../../unsafe"}}))).toMatch(/^req_[a-f0-9]{32}$/);});
});
