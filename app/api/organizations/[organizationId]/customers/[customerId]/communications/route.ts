import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  CommunicationIntegrityError,
  CommunicationValidationError,
  RecordCommunicationService,
  type CommunicationChannel,
  type CommunicationDirection,
  type CommunicationStatus,
} from "@/lib/application/communications";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresCommunicationProvider } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string; customerId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, customerId } = await context.params;
    if (!/^org_[a-z0-9_-]{6,64}$/.test(organizationId) || !/^cus_[a-z0-9_-]{6,64}$/.test(customerId)) {
      return problem(400, "invalid_request", "Organization or customer ID is invalid.");
    }
    const body = objectValue(await request.json());
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return problem(400, "invalid_request", "Idempotency-Key is required.");
    const channel = enumValue(body.channel, ["call", "sms", "email"] as const);
    const direction = enumValue(body.direction, ["inbound", "outbound"] as const);
    const status = enumValue(body.status, ["attempted", "sent", "delivered", "received", "failed"] as const);
    if (!channel || !direction || !status) return problem(400, "invalid_request", "Communication channel, direction, or status is invalid.");
    const locationId = optionalString(body.locationId);
    const result = await new RecordCommunicationService(
      new PostgresCommunicationProvider(pool, { userId: actor.userId, organizationId }),
    ).record({ actor, organizationId, ...(locationId ? { locationId } : {}), customerId,
      ...(optionalString(body.leadId) ? { leadId: optionalString(body.leadId) } : {}),
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      idempotencyKey, channel: channel as CommunicationChannel,
      direction: direction as CommunicationDirection, status: status as CommunicationStatus,
      occurredAt: stringValue(body.occurredAt), summary: stringValue(body.summary),
      ...(optionalString(body.externalMessageId) ? { externalMessageId: optionalString(body.externalMessageId) } : {}) });
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "You do not have permission to record this communication.");
    if (error instanceof CommunicationValidationError) return NextResponse.json(
      { error: "invalid_request", message: error.message, issues: error.issues },
      { status: 400, headers: { "cache-control": "no-store" } });
    if (error instanceof CommunicationIntegrityError) return problem(409, "data_conflict", error.message);
    return problem(500, "internal_error", "The communication could not be recorded.");
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CommunicationValidationError(["Request data must be an object."]);
  return value as Record<string, unknown>;
}
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value : undefined; }
function enumValue<const Values extends readonly string[]>(value: unknown, values: Values): Values[number] | undefined {
  return typeof value === "string" && values.includes(value) ? value as Values[number] : undefined;
}
function problem(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } });
}
