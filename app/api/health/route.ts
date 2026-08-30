import { NextResponse } from "next/server";
import { resolveReleaseInfo } from "@/lib/server/deployment";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "dealerflow-ai",
      release: resolveReleaseInfo(process.env),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
