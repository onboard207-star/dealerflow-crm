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
    const membership = assertAuthorized(actor, { capability: "lead.read", organizationId });
    const url = new URL(request.url);
    const result = await new CRMDirectoryReader(pool).listLeads({
      userId: actor.userId, organizationId, locationIds: membership.locationIds,
    }, { search: value(url, "q"), status: value(url, "status"), assignedUserId: value(url, "assignedUserId"), cursor: value(url, "cursor"), limit: numberValue(url, "limit") });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Lead access is not permitted.");
    if (error instanceof CRMDirectoryQueryError) return problem(400, "invalid_request", error.message);
    return problem(500, "internal_error", "Leads could not be loaded.");
  }
}
function value(url: URL, key: string) { return url.searchParams.get(key) ?? undefined; }
function numberValue(url: URL, key: string) { const value = url.searchParams.get(key); return value ? Number(value) : undefined; }
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
