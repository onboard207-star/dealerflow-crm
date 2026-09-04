import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  QuoteTermsIntegrityError,
  QuoteTermsService,
  QuoteTermsValidationError,
  type FinanceTermSourceType,
} from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import {
  AuthenticationError,
  MembershipError,
  PostgresMembershipReader,
  authenticateOrganizationRequest,
} from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresQuoteTermsProvider } from "@/lib/server/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ organizationId: string; quoteId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, quoteId } = await context.params;
    const body = objectValue(await request.json());
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const financeBody = body.finance === undefined ? undefined : objectValue(body.finance);
    const sourceType = financeBody ? enumValue(financeBody.sourceType, ["manual-entry", "lender-quote", "oem-program", "dealer-program"] as const) : undefined;
    if (financeBody && !sourceType) throw new QuoteTermsValidationError(["finance.sourceType is invalid."]);

    const result = await new QuoteTermsService(new PostgresQuoteTermsProvider(pool, { userId: actor.userId, organizationId })).create({
      actor,
      organizationId,
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      quoteId,
      ...(optionalInteger(body.cashDownCents) !== undefined ? { cashDownCents: optionalInteger(body.cashDownCents) } : {}),
      ...(optionalString(body.tradeAppraisalId) ? { tradeAppraisalId: optionalString(body.tradeAppraisalId) } : {}),
      ...(financeBody && sourceType ? { finance: {
        aprBasisPoints: integerValue(financeBody.aprBasisPoints),
        termMonths: integerValue(financeBody.termMonths),
        sourceType: sourceType as FinanceTermSourceType,
        sourceLabel: stringValue(financeBody.sourceLabel),
        ...(optionalString(financeBody.sourceReference) ? { sourceReference: optionalString(financeBody.sourceReference) } : {}),
      } } : {}),
    });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new QuoteTermsValidationError(["Request data must be an object."]);
  return value as Record<string, unknown>;
}
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function integerValue(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) ? value : Number.NaN; }
function optionalInteger(value: unknown) { return value === undefined ? undefined : integerValue(value); }
function enumValue<const V extends readonly string[]>(value: unknown, values: V): V[number] | undefined { return typeof value === "string" && values.includes(value) ? value as V[number] : undefined; }
function failure(error: unknown) {
  if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
  if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
  if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Quote terms are not permitted.");
  if (error instanceof QuoteTermsValidationError) return NextResponse.json({ error: "invalid_request", message: error.message, issues: error.issues }, { status: 400, headers: { "cache-control": "no-store" } });
  if (error instanceof QuoteTermsIntegrityError) return problem(409, "data_conflict", error.message);
  return problem(500, "internal_error", "Quote terms could not be saved.");
}
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
