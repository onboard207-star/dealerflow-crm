import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertAuthorized, AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool, withTenantDatabaseContext } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context { params: Promise<{ organizationId: string; inventoryUnitId: string; listingId: string }> }

export async function PATCH(request: Request, context: Context) {
  const correlationId = request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`;
  try {
    const { organizationId, inventoryUnitId, listingId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const status = body.status === "Active" || body.status === "Paused" || body.status === "Removed" || body.status === "Unknown" ? body.status : undefined;
    const removalTaskStatus = body.removalTaskStatus === "Not Needed" || body.removalTaskStatus === "Open" || body.removalTaskStatus === "Completed" ? body.removalTaskStatus : undefined;
    if (!status && !removalTaskStatus) return problem(400, "invalid_request", "Provide a valid listing status or removal task status.", correlationId);
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    assertAuthorized(actor, { capability: "inventory.update", organizationId });
    const result = await withTenantDatabaseContext(pool, { userId: actor.userId, organizationId }, async (db) => {
      const values: unknown[] = [organizationId, inventoryUnitId, listingId];
      const assignments: string[] = [];
      if (status) { values.push(status); assignments.push(`status=$${values.length}`); }
      if (removalTaskStatus) { values.push(removalTaskStatus); assignments.push(`removal_task_status=$${values.length}`); }
      const updated = await db.query(`UPDATE vehicle_listings SET ${assignments.join(",")}, updated_at=now() WHERE organization_id=$1 AND inventory_unit_id=$2 AND id=$3 RETURNING id, status, removal_task_status`, values);
      return (updated as { rows: Array<{ id: string; status: string; removal_task_status: string }> }).rows[0] ?? null;
    });
    if (!result) return problem(404, "not_found", "Listing was not found.", correlationId);
    return NextResponse.json({ listing: { id: result.id, status: result.status, removalTaskStatus: result.removal_task_status } }, { headers: { "cache-control": "no-store", "x-correlation-id": correlationId } });
  } catch (error) {
    if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.", correlationId);
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message, correlationId);
    if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "You do not have permission to update listings.", correlationId);
    return problem(500, "internal_error", "Listing could not be updated.", correlationId);
  }
}

function problem(status: number, error: string, message: string, correlationId: string) {
  return NextResponse.json({ error, message, correlationId }, { status, headers: { "cache-control": "no-store", "x-correlation-id": correlationId } });
}
