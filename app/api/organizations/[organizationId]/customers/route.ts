import { NextResponse } from "next/server";

import { AuthorizationError, assertAuthorized } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { CRMDirectoryQueryError, CRMDirectoryReader } from "@/lib/server/crm";
import { getDatabasePool } from "@/lib/server/database";

export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params; const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const membership = assertAuthorized(actor, { capability: "customer.read", organizationId });
    const url = new URL(request.url);
    const result = await new CRMDirectoryReader(pool).listCustomers({
      userId: actor.userId, organizationId, locationIds: membership.locationIds,
    }, { search: value(url, "q"), cursor: value(url, "cursor"), limit: numberValue(url, "limit") });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

function value(url: URL, key: string) { return url.searchParams.get(key) ?? undefined; }
function numberValue(url: URL, key: string) { const value = url.searchParams.get(key); return value ? Number(value) : undefined; }
function failure(error: unknown) {
  if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
  if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Customer access is not permitted.");
  if (error instanceof CRMDirectoryQueryError) return problem(400, "invalid_request", error.message);
  return problem(500, "internal_error", "Customers could not be loaded.");
}
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
