import { NextResponse } from "next/server";
import { InviteMemberService, InvitationValidationError } from "@/lib/application/organizations";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { parseServerEnvironment } from "@/lib/server/config";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresTransactionalEmailQueue } from "@/lib/server/email";
import { PostgresInvitationProvider, QueuedInvitationEmailSender } from "@/lib/server/organizations";
import { InvitationDirectoryReader } from "@/lib/server/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const membership = actor.memberships[0];
    if (!membership?.capabilities.includes("staff.manage")) return problem(403, "forbidden", "Staff invitations are not permitted.");
    return NextResponse.json(await new InvitationDirectoryReader(pool).list({ userId: actor.userId, organizationId }), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError) return problem(403, "forbidden", "Staff invitations are not permitted.");
    return problem(500, "internal_error", "Invitations could not be loaded.");
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const body: unknown = await request.json();
    if (!isBody(body)) return problem(400, "invalid_request", "Invitation data is invalid.");
    const environment = parseServerEnvironment(process.env, { authentication: true });
    const service = new InviteMemberService(new PostgresInvitationProvider(pool, environment.authUrl!), new QueuedInvitationEmailSender(new PostgresTransactionalEmailQueue(pool), environment.authUrl!));
    const result = await service.invite({ actor, organizationId, email: body.email, roleIds: body.roleIds, locationIds: body.locationIds, allLocations: body.allLocations, idempotencyKey: body.idempotencyKey });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Staff invitations are not permitted.");
    if (error instanceof InvitationValidationError || error instanceof SyntaxError) return problem(400, "invalid_request", error instanceof Error ? error.message : "Invitation data is invalid.");
    return problem(500, "internal_error", "The invitation could not be created.");
  }
}

function isBody(value: unknown): value is { email: string; roleIds: string[]; locationIds: string[]; allLocations: boolean; idempotencyKey: string } {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.email === "string" && Array.isArray(item.roleIds) && item.roleIds.every((id) => typeof id === "string") && Array.isArray(item.locationIds) && item.locationIds.every((id) => typeof id === "string") && typeof item.allLocations === "boolean" && typeof item.idempotencyKey === "string";
}
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
