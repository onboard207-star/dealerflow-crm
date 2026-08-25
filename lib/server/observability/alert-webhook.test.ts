import { createHmac } from "node:crypto";
import { describe,expect,it,vi } from "vitest";
import { AlertDeliveryError,SignedAlertWebhook } from "./alert-webhook";

describe("SignedAlertWebhook",()=>{
  it("delivers a signed, versioned, privacy-safe alert",async()=>{const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:204}));const gateway=new SignedAlertWebhook({url:"https://alerts.example.com/events",secret:"a-32-character-operational-secret-key",fetch:request,now:()=>new Date("2026-08-24T12:00:00Z")});await gateway.deliver({code:"outbound.job.completed",severity:"warning",correlationId:"req_12345678",attributes:{failed:1,customerEmail:"private@example.com"}});const options=request.mock.calls[0]?.[1];const body=String(options?.body);expect(body).not.toContain("private@example.com");expect(options?.headers).toMatchObject({"x-dealerflow-signature":`sha256=${createHmac("sha256","a-32-character-operational-secret-key").update(body).digest("hex")}`});});
  it("returns a sanitized error for provider failures",async()=>{const request=vi.fn<typeof fetch>().mockResolvedValue(new Response("provider secret",{status:500}));await expect(new SignedAlertWebhook({url:"https://alerts.example.com/events",secret:"a-32-character-operational-secret-key",fetch:request}).deliver({code:"email.job.failed",severity:"error",correlationId:"req_12345678"})).rejects.toBeInstanceOf(AlertDeliveryError);});
});
