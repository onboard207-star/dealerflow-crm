import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submit = vi.fn();
vi.mock("@/lib/server/database", () => ({ getDatabasePool: () => ({}) }));
vi.mock("@/lib/server/commercial/demo-request-intake", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/commercial/demo-request-intake")>();
  return { ...actual, DemoRequestIntake: class { submit = submit; } };
});
import { DemoRequestRateLimitError } from "@/lib/server/commercial/demo-request-intake";
import { POST } from "./route";

const body = { firstName: "Casey", lastName: "Synthetic", email: "casey@example.com", dealership: "Synthetic Dealer", role: "Sales Manager", rooftops: "1", interest: "Sales and BDC", contact: "Email" };
const environment = { DEALERFLOW_PUBLIC_INTAKE_SECRET: "s".repeat(32), DEALERFLOW_COMMERCIAL_OWNER_EMAIL: "owner@example.com" };
const request = (value: unknown = body, key = "request-1") => new Request("https://dealerflow.example/api/commercial/demo-requests", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, "x-forwarded-for": "192.0.2.10", "x-request-id": "request_test_123" }, body: JSON.stringify(value) });

describe("commercial demo request route", () => {
  beforeEach(() => { submit.mockReset().mockResolvedValue({ id: "cdr_request01", created: true }); Object.assign(process.env, environment); });
  afterEach(() => { delete process.env.DEALERFLOW_PUBLIC_INTAKE_SECRET; delete process.env.DEALERFLOW_COMMERCIAL_OWNER_EMAIL; });

  it("accepts a governed request with a stable correlation ID", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get("x-correlation-id")).toBe("request_test_123");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "received", reference: "cdr_request01" });
    expect(submit).toHaveBeenCalledWith(body, "192.0.2.10", "request-1");
  });

  it("returns 200 for an idempotent replay", async () => {
    submit.mockResolvedValue({ id: "cdr_request01", created: false });
    expect((await POST(request())).status).toBe(200);
  });

  it("fails closed when configuration or idempotency is missing", async () => {
    delete process.env.DEALERFLOW_PUBLIC_INTAKE_SECRET;
    expect((await POST(request())).status).toBe(503);
    Object.assign(process.env, environment);
    expect((await POST(request(body, ""))).status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("returns sanitized rate-limit and malformed-json responses", async () => {
    submit.mockRejectedValue(new DemoRequestRateLimitError());
    const limited = await POST(request());
    expect(limited.status).toBe(429);
    expect(JSON.stringify(await limited.json())).not.toContain("192.0.2.10");
    const malformed = await POST(new Request("https://dealerflow.example/api/commercial/demo-requests", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "request-2" }, body: "{" }));
    expect(malformed.status).toBe(500);
    expect(JSON.stringify(await malformed.json())).not.toContain("SyntaxError");
  });
});
