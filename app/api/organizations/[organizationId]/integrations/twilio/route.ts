import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { IntegrationConfigurationError, ProvisionTwilioIntegrationService } from "@/lib/application/integrations";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresIntegrationConfigurationProvider } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";
interface Context { params: Promise<{ organizationId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params; const body = objectValue(await request.json());
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(request, organizationId, new PostgresMembershipReader(pool));
    const locationId = optional(body.locationId);
    const result = await new ProvisionTwilioIntegrationService(
      new PostgresIntegrationConfigurationProvider(pool, { userId: actor.userId, organizationId }),
    ).provision({ actor, organizationId, ...(locationId ? { locationId } : {}),
      correlationId: request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`,
      providerAccountId: string(body.providerAccountId), credentialReference: string(body.credentialReference),
      publicBaseUrl: string(body.publicBaseUrl),
      ...(optional(body.defaultFromAddress) ? { defaultFromAddress: optional(body.defaultFromAddress) } : {}) });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.");
    if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message);
    if (error instanceof MembershipError || error instanceof AuthorizationError) return problem(403, "forbidden", "Integration configuration is not permitted.");
    if (error instanceof IntegrationConfigurationError) return NextResponse.json(
      { error: "invalid_request", message: error.message, issues: error.issues },
      { status: 400, headers: { "cache-control": "no-store" } });
    return problem(409, "integration_conflict", "The integration could not be provisioned.");
  }
}
function objectValue(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new IntegrationConfigurationError(["Request data must be an object."]); return value as Record<string, unknown>; }
function string(value: unknown) { return typeof value === "string" ? value : ""; }
function optional(value: unknown) { return typeof value === "string" && value.trim() ? value : undefined; }
function problem(status: number, error: string, message: string) { return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } }); }
