import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DealDocumentIntegrityError, DealDocumentService, DealDocumentValidationError } from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresDealDocumentProvider } from "@/lib/server/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string; dealId: string; requirementId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, dealId, requirementId } = await context.params;
    const body = await request.json() as unknown;
    const value = typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key) return problem(400, "invalid_request", "Idempotency-Key is required.");
    const statuses = ["generated", "provided", "complete", "waived", "unavailable"] as const;
    const toStatus = typeof value.toStatus === "string" && statuses.includes(value.toStatus as typeof statuses[number]) ? value.toStatus as typeof statuses[number] : undefined;
    if (!toStatus) throw new DealDocumentValidationError(["toStatus is invalid."]);
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const result = await new DealDocumentService(new PostgresDealDocumentProvider(pool, { userId: actor.userId, organizationId })).transition({ actor, organizationId, correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`, idempotencyKey: key, dealId, requirementId, toStatus, ...(typeof value.reason === "string" && value.reason.trim() ? { reason: value.reason.trim() } : {}) });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Document transition is not permitted.");
    if (error instanceof DealDocumentValidationError) return NextResponse.json({ error: "invalid_request", message: error.message, issues: error.issues }, { status: 400, headers: { "cache-control": "no-store" } });
    if (error instanceof DealDocumentIntegrityError) return problem(409, "data_conflict", error.message);
    return problem(500, "internal_error", "The document could not be updated.");
  }
}

function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
