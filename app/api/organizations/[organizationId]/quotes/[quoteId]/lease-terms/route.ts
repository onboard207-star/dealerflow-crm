import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { QuoteLeaseIntegrityError, QuoteLeaseTermsService, QuoteLeaseValidationError, type LeaseTermSourceType } from "@/lib/application/deals";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresQuoteLeaseProvider } from "@/lib/server/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string; quoteId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, quoteId } = await context.params;
    const body = objectValue(await request.json());
    const sourceType = enumValue(body.sourceType, ["manual-entry", "lender-quote", "oem-program", "dealer-program"] as const);
    if (!sourceType) throw new QuoteLeaseValidationError(["sourceType is invalid."]);
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const result = await new QuoteLeaseTermsService(new PostgresQuoteLeaseProvider(pool, { userId: actor.userId, organizationId })).create({
      actor, organizationId, quoteId,
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      adjustedCapCostCents: integerValue(body.adjustedCapCostCents),
      residualValueCents: integerValue(body.residualValueCents),
      moneyFactorPpm: integerValue(body.moneyFactorPpm),
      termMonths: integerValue(body.termMonths),
      ...(optionalInteger(body.annualMileage) !== undefined ? { annualMileage: optionalInteger(body.annualMileage) } : {}),
      ...(optionalInteger(body.acquisitionFeeCents) !== undefined ? { acquisitionFeeCents: optionalInteger(body.acquisitionFeeCents) } : {}),
      ...(optionalInteger(body.capCostReductionCents) !== undefined ? { capCostReductionCents: optionalInteger(body.capCostReductionCents) } : {}),
      ...(optionalInteger(body.rebateCents) !== undefined ? { rebateCents: optionalInteger(body.rebateCents) } : {}),
      sourceType: sourceType as LeaseTermSourceType,
      sourceLabel: stringValue(body.sourceLabel),
      ...(optionalString(body.sourceReference) ? { sourceReference: optionalString(body.sourceReference) } : {}),
    });
    return NextResponse.json({ terms: result }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) { return failure(error); }
}

function objectValue(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new QuoteLeaseValidationError(["Request data must be an object."]); return value as Record<string, unknown>; }
function integerValue(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) ? value : Number.NaN; }
function optionalInteger(value: unknown) { return value === undefined ? undefined : integerValue(value); }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function enumValue<const V extends readonly string[]>(value: unknown, values: V): V[number] | undefined { return typeof value === "string" && values.includes(value) ? value as V[number] : undefined; }
function failure(error: unknown) {
  if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
  if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
  if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Quote lease terms are not permitted.");
  if (error instanceof QuoteLeaseValidationError) return NextResponse.json({ error: "invalid_request", message: error.message, issues: error.issues }, { status: 400, headers: { "cache-control": "no-store" } });
  if (error instanceof QuoteLeaseIntegrityError) return problem(409, "data_conflict", error.message);
  return problem(500, "internal_error", "Quote lease terms could not be saved.");
}
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
