import { randomUUID } from "node:crypto";

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
      correlationId:
        request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      idempotencyKey,
      source: stringValue(body.source),
      ...(optionalString(body.sourceDetail)
        ? { sourceDetail: optionalString(body.sourceDetail) }
        : {}),
      ...(optionalString(body.assignedUserId)
        ? { assignedUserId: optionalString(body.assignedUserId) }
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

    return NextResponse.json(result, {
      status: result.leadCreated ? 201 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return problem(400, "invalid_json", "Request body must be valid JSON.");
    }
    if (error instanceof AuthenticationError) {
      return problem(401, "unauthorized", error.message);
    }
    if (error instanceof MembershipError || error instanceof AuthorizationError) {
      return problem(403, "forbidden", "You do not have permission to create this lead.");
    }
    if (error instanceof LeadIntakeValidationError) {
      return NextResponse.json(
        { error: "invalid_request", message: error.message, issues: error.issues },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    if (error instanceof LeadIntakeIntegrityError) {
      return problem(409, "data_conflict", error.message);
    }
    return problem(500, "internal_error", "The lead could not be created.");
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

function problem(status: number, error: string, message: string) {
  return NextResponse.json(
    { error, message },
    { status, headers: { "cache-control": "no-store" } },
  );
}
