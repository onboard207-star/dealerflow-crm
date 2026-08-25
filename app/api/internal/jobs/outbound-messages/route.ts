import { NextResponse } from "next/server";
import { OutboundMessagingService, OutboundWorker } from "@/lib/application/communications";
import { PostgresDueOutboundDiscovery, PostgresOutboundGatewayResolver, PostgresOutboundMessagingProvider } from "@/lib/server/communications";
import { parseServerEnvironment } from "@/lib/server/config";
import { getDatabasePool } from "@/lib/server/database";
import { authenticateJobRequest } from "@/lib/server/jobs";
import { OperationalReporter, StructuredTelemetry, resolveCorrelationId } from "@/lib/server/observability";

export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;
export async function POST(request: Request) {
  const correlationId=resolveCorrelationId(request);
  let environment;
  try { environment = parseServerEnvironment(process.env, { database: true, jobs: true }); }
  catch { new StructuredTelemetry().emit({code:"outbound.job.configuration_unavailable",severity:"error",correlationId});return problem(503, "job_unavailable", "Outbound processing is not configured.",correlationId); }
  if (!authenticateJobRequest(request, environment.jobSecret!)) return problem(401, "unauthorized", "Job authentication failed.",correlationId);
  const limit = numberValue(new URL(request.url).searchParams.get("limit"), 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return problem(400, "invalid_request", "limit must be between 1 and 100.",correlationId);
  try {
    const pool = getDatabasePool(); const userId = "usr_job_system";
    const worker = new OutboundWorker(new PostgresDueOutboundDiscovery(pool), (organizationId) =>
      new OutboundMessagingService(new PostgresOutboundMessagingProvider(pool, { userId, organizationId }),
        new PostgresOutboundGatewayResolver(pool, { userId, organizationId })));
    const result=await worker.run(limit);const unhealthy=result.failed>0||result.deliveryUnknown>0;
    await new OperationalReporter(environment).report({code:"outbound.job.completed",severity:unhealthy?"warning":"info",correlationId,attributes:{discovered:result.discovered,accepted:result.accepted,rejected:result.rejected,deliveryUnknown:result.deliveryUnknown,skipped:result.skipped,failed:result.failed}},{alert:unhealthy});
    return NextResponse.json(result, { headers: { "cache-control": "no-store","x-correlation-id":correlationId } });
  } catch { await new OperationalReporter(environment).report({code:"outbound.job.failed",severity:"error",correlationId},{alert:true});return problem(500, "job_failed", "Outbound processing did not complete.",correlationId); }
}
function numberValue(value: string | null, fallback: number) { return value === null ? fallback : Number(value); }
function problem(status: number, error: string, message: string,correlationId:string) { return NextResponse.json({ error,message,correlationId }, { status, headers: { "cache-control":"no-store","x-correlation-id":correlationId } }); }
