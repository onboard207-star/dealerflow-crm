import { NextResponse } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { acceptOrganizationInvitation, InvitationAcceptanceError } from "@/lib/server/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user.id) return problem(401, "unauthorized", "Sign in with the invited email address first.");
    const body: unknown = await request.json();
    if (!isBody(body)) return problem(400, "invalid_request", "An invitation token is required.");
    return NextResponse.json(await acceptOrganizationInvitation(getDatabasePool(), session.user.id, body.token), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof InvitationAcceptanceError) return problem(400, "invalid_invitation", error.message);
    return problem(500, "internal_error", "The invitation could not be accepted.");
  }
}
function isBody(value: unknown): value is { token: string } { return typeof value === "object" && value !== null && "token" in value && typeof value.token === "string"; }
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
