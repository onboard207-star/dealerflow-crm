import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  VehicleConfigurationMatchError,
  VehicleConfigurationMatchService,
} from "@/lib/application/vehicle-catalog";
import { AuthorizationError } from "@/lib/platform/auth";
import {
  AuthenticationError,
  MembershipError,
  PostgresMembershipReader,
  authenticateOrganizationRequest,
} from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresVehicleConfigurationMatchProvider } from "@/lib/server/vehicles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ organizationId: string; vehicleId: string }>;
}

export async function GET(request: Request, context: Context) {
  const correlationId = request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`;
  try {
    const { organizationId, vehicleId } = await context.params;
    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(
      request,
      organizationId,
      new PostgresMembershipReader(pool),
    );
    const result = await new VehicleConfigurationMatchService(
      new PostgresVehicleConfigurationMatchProvider(pool, { userId: actor.userId, organizationId }),
    ).candidates({ actor, organizationId, vehicleId });
    return NextResponse.json(result, {
      headers: { "cache-control": "private, no-store", "x-correlation-id": correlationId },
    });
  } catch (error) {
    return failure(error, correlationId);
  }
}

export async function POST(request: Request, context: Context) {
  const correlationId =
    request.headers.get("x-correlation-id")?.trim() || `req_${randomUUID()}`;
  try {
    const { organizationId, vehicleId } = await context.params;
    const body = objectValue(await request.json());
    const configurationId = requiredString(body.configurationId);
    const source = requiredString(body.source);
    if (!configurationId || !source) {
      return problem(
        400,
        "invalid_request",
        "configurationId and source are required.",
        correlationId,
      );
    }

    const pool = getDatabasePool();
    const actor = await authenticateOrganizationRequest(
      request,
      organizationId,
      new PostgresMembershipReader(pool),
    );
    const result = await new VehicleConfigurationMatchService(
      new PostgresVehicleConfigurationMatchProvider(pool, {
        userId: actor.userId,
        organizationId,
      }),
    ).match({ actor, organizationId, vehicleId, configurationId, source });

    return NextResponse.json(result, {
      status: result.created ? 201 : 200,
      headers: {
        "cache-control": "private, no-store",
        "x-correlation-id": correlationId,
      },
    });
  } catch (error) {
    return failure(error, correlationId);
  }
}

function failure(error: unknown, correlationId: string) {
  if (error instanceof SyntaxError) return problem(400, "invalid_json", "Request body must be valid JSON.", correlationId);
  if (error instanceof AuthenticationError) return problem(401, "unauthorized", error.message, correlationId);
  if (error instanceof MembershipError || error instanceof AuthorizationError) {
    return problem(403, "forbidden", "You do not have permission to verify vehicle catalog matches.", correlationId);
  }
  if (error instanceof VehicleConfigurationMatchError) return problem(409, "data_conflict", error.message, correlationId);
  return problem(500, "internal_error", "The vehicle catalog match could not be recorded.", correlationId);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function problem(
  status: number,
  error: string,
  message: string,
  correlationId: string,
) {
  return NextResponse.json(
    { error, message, correlationId },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-correlation-id": correlationId,
      },
    },
  );
}
