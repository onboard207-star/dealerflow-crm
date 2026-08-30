export const meaningfulProductEvents = [
  "customer.opened", "lead.responded", "task.completed", "appointment.created", "appointment.confirmed",
  "inventory.opened", "inventory.photo-added", "deal.opened", "manager.exception-reviewed",
  "ai.summary-requested", "ai.feedback-recorded", "support.created",
] as const;

export type MeaningfulProductEvent = (typeof meaningfulProductEvents)[number];
export type TelemetryActorType = "dealer-user" | "dealerflow-staff" | "automation" | "synthetic";
export type TelemetryDataClass = "demo" | "pilot" | "production";
export type TelemetryDeviceClass = "desktop" | "tablet" | "mobile" | "server";
export type TelemetryAttribute = string | number | boolean | null;

export interface ProductUsageEventInput {
  organizationId: string;
  userId?: string;
  locationId?: string;
  eventName: MeaningfulProductEvent;
  actorType: TelemetryActorType;
  dataClass: TelemetryDataClass;
  workspace: string;
  feature: string;
  action: string;
  roleKey?: string;
  release: string;
  deviceClass: TelemetryDeviceClass;
  requestId?: string;
  featureFlags?: Readonly<Record<string, boolean>>;
  attributes?: Readonly<Record<string, TelemetryAttribute>>;
  idempotencyKey: string;
  occurredAt: string;
}

const sensitiveKey = /(body|message|note|password|secret|token|ssn|credit|bank|account|document|prompt|email|phone|address|vin|name)/i;
const slug = /^[a-z][a-z0-9-]{1,63}$/;

export class ProductTelemetryValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ProductTelemetryValidationError"; }
}

export function validateProductUsageEvent(input: ProductUsageEventInput): ProductUsageEventInput {
  if (!/^org_[a-z0-9_-]{6,64}$/.test(input.organizationId)) fail("A valid tenant is required.");
  if (!meaningfulProductEvents.includes(input.eventName)) fail("The product event is not governed.");
  if (!slug.test(input.workspace) || !slug.test(input.feature) || !slug.test(input.action)) fail("Workspace, feature, and action must use governed identifiers.");
  if (!/^[a-zA-Z0-9._-]{2,100}$/.test(input.release)) fail("A valid release is required.");
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200) fail("A bounded idempotency key is required.");
  if (Number.isNaN(Date.parse(input.occurredAt))) fail("A valid event time is required.");
  const attributes = input.attributes ?? {};
  if (Object.keys(attributes).length > 20) fail("Telemetry attributes are limited to 20 values.");
  for (const [key, value] of Object.entries(attributes)) {
    if (!slug.test(key) || sensitiveKey.test(key)) fail("Sensitive or ungoverned telemetry attributes are not permitted.");
    if (typeof value === "string" && value.length > 200) fail("Telemetry string attributes are limited to 200 characters.");
    if (typeof value === "number" && !Number.isFinite(value)) fail("Telemetry numbers must be finite.");
  }
  return Object.freeze({ ...input, featureFlags: Object.freeze({ ...(input.featureFlags ?? {}) }), attributes: Object.freeze({ ...attributes }) });
}

export function countsTowardHumanAdoption(event: Pick<ProductUsageEventInput, "actorType" | "dataClass">): boolean {
  return event.actorType === "dealer-user" && event.dataClass !== "demo";
}

function fail(message: string): never { throw new ProductTelemetryValidationError(message); }
