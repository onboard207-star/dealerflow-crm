import { NextResponse } from "next/server";

import { getDatabasePool } from "@/lib/server/database";
import { evaluateReadiness } from "@/lib/server/health/readiness";
import { parseServerEnvironment } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await evaluateReadiness([
    {
      name: "database",
      check: async () => {
        await getDatabasePool().query("SELECT 1");
      },
    },
    {
      name: "runtime-configuration",
      check: async () => {
        parseServerEnvironment(process.env, { authentication: true, jobs: true, email: true, ai: true });
      },
    },
  ]);

  return NextResponse.json(
    {
      status: result.ready ? "ready" : "unavailable",
      checks: result.checks,
    },
    {
      status: result.ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
