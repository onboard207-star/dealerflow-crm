import { randomUUID } from "node:crypto";

export type TelemetrySeverity = "info" | "warning" | "error";
export type TelemetryValue = string | number | boolean | null;
export interface TelemetryEvent {
  code: string;
  severity: TelemetrySeverity;
  correlationId: string;
  timestamp?: string;
  organizationId?: string;
  attributes?: Readonly<Record<string, TelemetryValue>>;
}
export interface TelemetrySink { write(line: string, severity: TelemetrySeverity): void }

const forbiddenAttribute = /(email|phone|address|destination|body|content|password|secret|token|authorization|cookie)/i;
export class StructuredTelemetry {
  constructor(private readonly sink: TelemetrySink = processTelemetrySink) {}
  emit(event: TelemetryEvent): void {
    if (!/^[a-z][a-z0-9._-]{2,100}$/.test(event.code)) throw new TypeError("Telemetry code is invalid.");
    if (!/^req_[a-z0-9_-]{8,80}$/.test(event.correlationId)) throw new TypeError("Telemetry correlation ID is invalid.");
    const safe=sanitizeTelemetryEvent(event);
    this.sink.write(JSON.stringify({ timestamp:safe.timestamp??new Date().toISOString(),severity:safe.severity,code:safe.code,correlationId:safe.correlationId,...(safe.organizationId?{organizationId:safe.organizationId}:{}),attributes:safe.attributes }),safe.severity);
  }
}
export function sanitizeTelemetryEvent(event:TelemetryEvent):TelemetryEvent{return{...event,attributes:Object.fromEntries(Object.entries(event.attributes??{}).filter(([key])=>!forbiddenAttribute.test(key)))};}
export function resolveCorrelationId(request: Request): string {
  const supplied=request.headers.get("x-correlation-id")?.trim();
  return supplied&&/^req_[a-z0-9_-]{8,80}$/.test(supplied)?supplied:`req_${randomUUID().replaceAll("-","")}`;
}
const processTelemetrySink:TelemetrySink={write(line,severity){const stream=severity==="error"?process.stderr:process.stdout;stream.write(`${line}\n`);}};
