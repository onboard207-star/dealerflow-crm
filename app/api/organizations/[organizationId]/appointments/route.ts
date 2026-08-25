import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  AppointmentIntegrityError,
  AppointmentValidationError,
  ScheduleAppointmentService,
} from "@/lib/application/appointments";
import { AuthorizationError } from "@/lib/platform/auth";
import {
  AuthenticationError,
  MembershipError,
  PostgresMembershipReader,
  authenticateOrganizationRequest,
} from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresCRMDataProvider } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ organizationId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    if (!/^org_[a-z0-9_-]{6,64}$/.test(organizationId)) {
      return problem(400, "invalid_request", "Organization ID is invalid.");
    }
    const body = objectValue(await request.json());
    const followUp = objectValue(body.followUp);
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
    const result = await new ScheduleAppointmentService(
      new PostgresCRMDataProvider(pool, { userId: actor.userId, organizationId }),
    ).schedule({
      actor, organizationId, ...(locationId ? { locationId } : {}),
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      idempotencyKey, customerId: stringValue(body.customerId),
      leadId: stringValue(body.leadId),
      ...(optionalString(body.assignedUserId) ? { assignedUserId: optionalString(body.assignedUserId) } : {}),
      type: stringValue(body.type), startsAt: stringValue(body.startsAt),
      endsAt: stringValue(body.endsAt), timezone: stringValue(body.timezone),
      ...(optionalString(body.notes) ? { notes: optionalString(body.notes) } : {}),
      followUp: {
        title: stringValue(followUp.title), dueAt: stringValue(followUp.dueAt),
        ...(isPriority(followUp.priority) ? { priority: followUp.priority } : {}),
      },
    });
    return NextResponse.json(result, {
      status: result.created ? 201 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) {
      return problem(403, "forbidden", "You do not have permission to schedule this appointment.");
    }
    if (error instanceof AppointmentValidationError) {
      return NextResponse.json(
        { error: "invalid_request", message: error.message, issues: error.issues },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    if (error instanceof AppointmentIntegrityError) return problem(409, "data_conflict", error.message);
    return problem(500, "internal_error", "The appointment could not be scheduled.");
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppointmentValidationError(["Request data must be an object."]);
  }
  return value as Record<string, unknown>;
}
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value : undefined; }
function isPriority(value: unknown): value is "low" | "normal" | "high" | "urgent" {
  return value === "low" || value === "normal" || value === "high" || value === "urgent";
}
function problem(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } });
}
