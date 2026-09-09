import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  DealVehicleChangeIntegrityError,
  DealVehicleChangeService,
  DealVehicleChangeValidationError,
} from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import {
  AuthenticationError,
  MembershipError,
  PostgresMembershipReader,
  authenticateOrganizationRequest,
} from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresDealVehicleChangeProvider } from "@/lib/server/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ organizationId: string; dealId: string }>;
}

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, dealId } = await context.params;
    const body = object(await request.json());
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return problem(400, "invalid_request", "Idempotency-Key is required.");

    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(
      request,
      organizationId,
      new PostgresMembershipReader(pool),
    );
    const result = await new DealVehicleChangeService(
      new PostgresDealVehicleChangeProvider(pool, { userId: actor.userId, organizationId }),
    ).change({
      actor,
      organizationId,
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      idempotencyKey,
      dealId,
      customerId: string(body.customerId),
      leadId: string(body.leadId),
      toVehicleId: string(body.vehicleId),
      toInventoryUnitId: string(body.inventoryUnitId),
      reason: string(body.reason),
    });
    return NextResponse.json(result, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) {
      return problem(403, "forbidden", "Deal vehicle change is not permitted.");
    }
    if (error instanceof DealVehicleChangeValidationError) {
      return NextResponse.json(
        { error: "invalid_request", message: error.message, issues: error.issues },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    if (error instanceof DealVehicleChangeIntegrityError) return problem(409, "data_conflict", error.message);
    return problem(500, "internal_error", "The Deal vehicle could not be changed.");
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DealVehicleChangeValidationError(["Request data must be an object."]);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

function problem(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } });
}
