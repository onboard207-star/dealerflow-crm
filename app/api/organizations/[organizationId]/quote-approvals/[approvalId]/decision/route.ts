import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { QuoteApprovalIntegrityError, QuoteApprovalService, QuoteApprovalValidationError, type QuoteApprovalDecision } from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresQuoteApprovalProvider } from "@/lib/server/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string; approvalId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, approvalId } = await context.params;
    const body = objectValue(await request.json());
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return problem(400, "invalid_request", "Idempotency-Key is required.");
    const decision = enumValue(body.decision, ["approved", "declined"] as const);
    if (!decision) throw new QuoteApprovalValidationError(["decision is invalid."]);
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const reason = optionalString(body.reason);
    const result = await new QuoteApprovalService(new PostgresQuoteApprovalProvider(pool, { userId: actor.userId, organizationId })).decide({
      actor, organizationId, approvalId, decision: decision as QuoteApprovalDecision, idempotencyKey,
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      ...(reason ? { reason } : {}),
    });
    return NextResponse.json(result, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) { return failure(error); }
}

function objectValue(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new QuoteApprovalValidationError(["Request data must be an object."]); return value as Record<string, unknown>; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function enumValue<const V extends readonly string[]>(value: unknown, values: V): V[number] | undefined { return typeof value === "string" && values.includes(value) ? value as V[number] : undefined; }
function failure(error: unknown) {
  if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
  if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
  if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Quote approval decision is not permitted.");
  if (error instanceof QuoteApprovalValidationError) return NextResponse.json({ error: "invalid_request", message: error.message, issues: error.issues }, { status: 400, headers: { "cache-control": "no-store" } });
  if (error instanceof QuoteApprovalIntegrityError) return problem(409, "data_conflict", error.message);
  return problem(500, "internal_error", "Quote approval decision could not be saved.");
}
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
