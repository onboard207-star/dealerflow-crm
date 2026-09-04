import { NextResponse } from "next/server";

import {
  LeadIntakeIntegrityError,
  LeadIntakeService,
  LeadIntakeValidationError,
} from "@/lib/application/leads";
import { AuthorizationError } from "@/lib/platform/auth";
import {
  AuthenticationError,
  MembershipError,
  PostgresMembershipReader,
  authenticateOrganizationRequest,
} from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresCRMDataProvider } from "@/lib/server/data";
import { resolveCorrelationId, StructuredTelemetry } from "@/lib/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ organizationId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const correlationId = resolveCorrelationId(request);
  let organizationIdForTelemetry: string | undefined;
  try {
    const { organizationId } = await context.params;
    organizationIdForTelemetry = organizationId;
    if (!/^org_[a-z0-9_-]{6,64}$/.test(organizationId)) {
      return problem(400, "invalid_request", "Organization ID is invalid.", correlationId);
    }
    const body = await readObject(request);
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(
      request,
      organizationId,
      new PostgresMembershipReader(pool),
    );
    const locationId = optionalString(body.locationId);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return problem(400, "invalid_request", "Idempotency-Key is required.");
    }
    const customer = objectValue(body.customer);
    const service = new LeadIntakeService(
      new PostgresCRMDataProvider(pool, {
        userId: actor.userId,
        organizationId,
      }),
    );
    const result = await service.intake({
      actor,
      organizationId,
      ...(locationId ? { locationId } : {}),
      correlationId,
      idempotencyKey,
      source: stringValue(body.source),
      ...(optionalString(body.sourceLeadId)
        ? { sourceLeadId: optionalString(body.sourceLeadId) }
        : {}),
      ...(optionalString(body.sourceDetail)
        ? { sourceDetail: optionalString(body.sourceDetail) }
        : {}),
      ...(optionalString(body.assignedUserId)
        ? { assignedUserId: optionalString(body.assignedUserId) }
        : {}),
      ...(contactMethod(body.preferredContactMethod)
        ? { preferredContactMethod: contactMethod(body.preferredContactMethod) }
        : {}),
      ...(optionalObject(body.vehicleInterest)
        ? { vehicleInterest: vehicleValue(optionalObject(body.vehicleInterest)!) }
        : {}),
      ...(optionalString(body.message) ? { message: optionalString(body.message) } : {}),
      ...(typeof body.tradeInterest === "boolean"
        ? { tradeInterest: body.tradeInterest }
        : {}),
      ...(optionalObject(body.appointmentRequest)
        ? { appointmentRequest: appointmentValue(optionalObject(body.appointmentRequest)!) }
        : {}),
      ...(optionalString(body.receivedAt) ? { receivedAt: optionalString(body.receivedAt) } : {}),
      ...(optionalObject(body.rawPayload)
        ? { rawPayload: safeRawPayload(optionalObject(body.rawPayload)!) }
        : {}),
      customer: {
        displayName: stringValue(customer.displayName),
        ...(optionalString(customer.firstName)
          ? { firstName: optionalString(customer.firstName) }
          : {}),
        ...(optionalString(customer.lastName)
          ? { lastName: optionalString(customer.lastName) }
          : {}),
        ...(optionalString(customer.email)
          ? { email: optionalString(customer.email) }
          : {}),
        ...(optionalString(customer.phone)
          ? { phone: optionalString(customer.phone) }
          : {}),
      },
    });
    new StructuredTelemetry().emit({ code: "lead.intake.completed", severity: "info", correlationId, organizationId,
      attributes: { intakeId: result.intake.id, source: result.lead.source, customerCreated: result.customerCreated, leadCreated: result.leadCreated, vehicleResolved: result.intake.vehicle.resolved, communicationStatus: result.intake.communicationStatus } });

    return NextResponse.json(result, {
      status: result.leadCreated ? 201 : 200,
      headers: { "cache-control": "no-store", "x-correlation-id": correlationId },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return problem(400, "invalid_json", "Request body must be valid JSON.", correlationId);
    }
    if (error instanceof AuthenticationError) {
      return problem(401, "unauthorized", error.message, correlationId);
    }
    if (error instanceof MembershipError || error instanceof AuthorizationError) {
      return problem(403, "forbidden", "You do not have permission to create this lead.", correlationId);
    }
    if (error instanceof LeadIntakeValidationError) {
      return NextResponse.json(
        { error: "invalid_request", message: error.message, issues: error.issues },
        { status: 400, headers: { "cache-control": "no-store", "x-correlation-id": correlationId } },
      );
    }
    if (error instanceof LeadIntakeIntegrityError) {
      return problem(409, "data_conflict", error.message, correlationId);
    }
    new StructuredTelemetry().emit({ code: "lead.intake.failed", severity: "error", correlationId,
      ...(organizationIdForTelemetry ? { organizationId: organizationIdForTelemetry } : {}),
      attributes: { errorName: error instanceof Error ? error.name : "UnknownError" } });
    return problem(500, "internal_error", "The lead could not be created.", correlationId);
  }
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
  return objectValue(await request.json());
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LeadIntakeValidationError(["Request data must be an object."]);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function contactMethod(value: unknown): "phone" | "sms" | "email" | undefined {
  return value === "phone" || value === "sms" || value === "email" ? value : undefined;
}

function vehicleValue(value: Record<string, unknown>) {
  return {
    ...(optionalString(value.vin) ? { vin: optionalString(value.vin) } : {}),
    ...(optionalString(value.stockNumber) ? { stockNumber: optionalString(value.stockNumber) } : {}),
    ...(typeof value.year === "number" ? { year: value.year } : {}),
    ...(optionalString(value.make) ? { make: optionalString(value.make) } : {}),
    ...(optionalString(value.model) ? { model: optionalString(value.model) } : {}),
    ...(optionalString(value.trim) ? { trim: optionalString(value.trim) } : {}),
  };
}

function appointmentValue(value: Record<string, unknown>) {
  return {
    ...(optionalString(value.startsAt) ? { startsAt: optionalString(value.startsAt) } : {}),
    ...(optionalString(value.endsAt) ? { endsAt: optionalString(value.endsAt) } : {}),
    ...(optionalString(value.timezone) ? { timezone: optionalString(value.timezone) } : {}),
    ...(optionalString(value.notes) ? { notes: optionalString(value.notes) } : {}),
  };
}

function safeRawPayload(value: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(value);
  if (serialized.length > 32_768) {
    throw new LeadIntakeValidationError(["rawPayload must not exceed 32 KB."]);
  }
  const blocked = /password|secret|authorization|cookie|token|api[-_]?key/i;
  if (containsProtectedKey(value, blocked)) {
    throw new LeadIntakeValidationError(["rawPayload contains a protected credential field."]);
  }
  return value;
}

function containsProtectedKey(value: unknown, blocked: RegExp): boolean {
  if (Array.isArray(value)) return value.some((item) => containsProtectedKey(item, blocked));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) => blocked.test(key) || containsProtectedKey(item, blocked),
  );
}

function problem(status: number, error: string, message: string, correlationId?: string) {
  return NextResponse.json(
    { error, message, ...(correlationId ? { correlationId } : {}) },
    { status, headers: { "cache-control": "no-store", ...(correlationId ? { "x-correlation-id": correlationId } : {}) } },
  );
}
