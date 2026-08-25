import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { TradeVehicleService, VehicleIntegrityError, VehicleValidationError } from "@/lib/application/vehicles";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresVehicleProvider } from "@/lib/server/vehicles";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string; customerId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, customerId } = await context.params; const body = objectValue(await request.json()); const vehicle = objectValue(body.vehicle);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim(); if (!idempotencyKey) return problem(400, "invalid_request", "Idempotency-Key is required.");
    const pool = getDatabasePool(); const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const result = await new TradeVehicleService(new PostgresVehicleProvider(pool, { userId: actor.userId, organizationId })).add({
      actor, organizationId, locationId: stringValue(body.locationId), customerId, leadId: stringValue(body.leadId),
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`, idempotencyKey,
      vehicle: { vin: stringValue(vehicle.vin), year: numberValue(vehicle.year) ?? Number.NaN, make: stringValue(vehicle.make), model: stringValue(vehicle.model), ...(optionalString(vehicle.trim) ? { trim: optionalString(vehicle.trim) } : {}), ...(optionalString(vehicle.exteriorColor) ? { exteriorColor: optionalString(vehicle.exteriorColor) } : {}) },
      ...(optionalString(body.notes) ? { notes: optionalString(body.notes) } : {}),
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Trade-vehicle intake is not permitted.");
    if (error instanceof VehicleValidationError) return NextResponse.json({ error: "invalid_request", message: error.message, issues: error.issues }, { status: 400, headers: { "cache-control": "no-store" } });
    if (error instanceof VehicleIntegrityError) return problem(409, "data_conflict", error.message);
    return problem(500, "internal_error", "The trade vehicle could not be added.");
  }
}

function objectValue(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new VehicleValidationError(["Request data must be an object."]); return value as Record<string, unknown>; }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function numberValue(value: unknown) { return typeof value === "number" ? value : undefined; }
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
