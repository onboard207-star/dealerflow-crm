import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { ConsentValidationError, OutboundMessagingError, OutboundMessagingService } from "@/lib/application/communications";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { PostgresOutboundGatewayResolver, PostgresOutboundMessagingProvider } from "@/lib/server/communications";
import { getDatabasePool } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string; customerId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, customerId } = await context.params;
    const body = objectValue(await request.json());
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return problem(400, "invalid_request", "Idempotency-Key is required.");
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const locationId = optionalString(body.locationId);
    const service = new OutboundMessagingService(
      new PostgresOutboundMessagingProvider(pool, { userId: actor.userId, organizationId }),
      new PostgresOutboundGatewayResolver(pool, { userId: actor.userId, organizationId }),
    );
    const result = await service.recordConsent({ actor, organizationId,
      ...(locationId ? { locationId } : {}), customerId, idempotencyKey,
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      channel: enumValue(body.channel, ["call", "sms", "email"] as const) ?? "sms",
      purpose: enumValue(body.purpose, ["operational", "marketing"] as const) ?? "operational",
      action: enumValue(body.action, ["granted", "revoked"] as const) ?? invalid("action"),
      basis: enumValue(body.basis, ["express-written", "customer-initiated", "not-applicable"] as const) ?? invalid("basis"),
      address: stringValue(body.address), evidenceReference: stringValue(body.evidenceReference),
      occurredAt: stringValue(body.occurredAt),
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) { return failure(error, "Consent could not be recorded."); }
}

function objectValue(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConsentValidationError(["Request data must be an object."]); return value as Record<string, unknown>; }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value : undefined; }
function enumValue<const Values extends readonly string[]>(value: unknown, values: Values): Values[number] | undefined { return typeof value === "string" && values.includes(value) ? value as Values[number] : undefined; }
function invalid(field: string): never { throw new ConsentValidationError([`${field} is invalid.`]); }
function failure(error: unknown, fallback: string) {
  if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
  if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
  if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Communication consent access is not permitted.");
  if (error instanceof ConsentValidationError) return NextResponse.json({ error: "invalid_request", message: error.message, issues: error.issues }, { status: 400, headers: { "cache-control": "no-store" } });
  if (error instanceof OutboundMessagingError) return problem(409, error.code, error.message);
  return problem(500, "internal_error", fallback);
}
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
