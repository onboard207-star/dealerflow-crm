import { describe, expect, it, vi } from "vitest";

import type { ServerEnvironment } from "@/lib/server/config";
import { OperationalReporter } from "./operational-reporter";
import { StructuredTelemetry, type TelemetrySink } from "./telemetry";

const configuredEnvironment = {
  alertWebhookUrl: "https://alerts.example.com/events",
  alertWebhookSecret: "a-32-character-operational-secret-key",
} as ServerEnvironment;

describe("OperationalReporter", () => {
  it("always emits telemetry and does not call the webhook unless alerting is requested", async () => {
    const write = vi.fn<TelemetrySink["write"]>();
    const request = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", request);

    await new OperationalReporter(configuredEnvironment, new StructuredTelemetry({ write })).report({
      code: "outbound.job.completed",
      severity: "info",
      correlationId: "req_12345678",
      attributes: { failed: 0 },
    });

    expect(write).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("delivers an explicitly requested aggregate alert without sensitive attributes", async () => {
    const write = vi.fn<TelemetrySink["write"]>();
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", request);

    await new OperationalReporter(configuredEnvironment, new StructuredTelemetry({ write })).report({
      code: "email.job.completed",
      severity: "warning",
      correlationId: "req_12345678",
      attributes: { failed: 2, recipientEmail: "private@example.com" },
    }, { alert: true });

    expect(request).toHaveBeenCalledOnce();
    expect(String(request.mock.calls[0]?.[1]?.body)).not.toContain("private@example.com");
    vi.unstubAllGlobals();
  });

  it("keeps business processing independent when alert delivery fails", async () => {
    const write = vi.fn<TelemetrySink["write"]>();
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("destination unavailable"));
    vi.stubGlobal("fetch", request);

    await expect(new OperationalReporter(configuredEnvironment, new StructuredTelemetry({ write })).report({
      code: "outbound.job.failed",
      severity: "error",
      correlationId: "req_12345678",
    }, { alert: true })).resolves.toBeUndefined();

    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(write.mock.calls[1]?.[0] ?? "{}")).toMatchObject({
      code: "operations.alert.delivery_failed",
      severity: "error",
      correlationId: "req_12345678",
      attributes: { sourceCode: "outbound.job.failed" },
    });
    vi.unstubAllGlobals();
  });
});
