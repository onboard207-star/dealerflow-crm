import { NextResponse } from "next/server";
import { parseServerEnvironment } from "@/lib/server/config";
import { getDatabasePool } from "@/lib/server/database";
import { ResendTransactionalEmailGateway, TransactionalEmailOperationsReader, TransactionalEmailWorker } from "@/lib/server/email";
import { authenticateJobRequest } from "@/lib/server/jobs";
import { OperationalReporter, StructuredTelemetry, resolveCorrelationId } from "@/lib/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const correlationId=resolveCorrelationId(request);
  let environment;
  try{environment=parseServerEnvironment(process.env,{database:true,jobs:true,email:true});}
  catch{new StructuredTelemetry().emit({code:"email.job.configuration_unavailable",severity:"error",correlationId});return problem(503,"job_unavailable","Transactional email processing is not configured.",correlationId);}
  if (!authenticateJobRequest(request, environment.jobSecret!)) return problem(401, "unauthorized", "Job authentication failed.",correlationId);
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return problem(400, "invalid_request", "limit must be between 1 and 100.",correlationId);
  try {
    const gateway = new ResendTransactionalEmailGateway({ apiKey: environment.resendApiKey!, from: environment.emailFrom!, ...(environment.emailReplyTo ? { replyTo: environment.emailReplyTo } : {}) });
    const result=await new TransactionalEmailWorker(getDatabasePool(), gateway).run(limit);const unhealthy=result.failed>0;
    await new OperationalReporter(environment).report({code:"email.job.completed",severity:unhealthy?"warning":"info",correlationId,attributes:{claimed:result.claimed,sent:result.sent,failed:result.failed}},{alert:unhealthy});
    return NextResponse.json(result, { headers: { "cache-control":"no-store","x-correlation-id":correlationId } });
  } catch { await new OperationalReporter(environment).report({code:"email.job.failed",severity:"error",correlationId},{alert:true});return problem(500,"job_failed","Transactional email processing did not complete.",correlationId); }
}

export async function GET(request: Request) {
  const correlationId=resolveCorrelationId(request);
  try {
    const environment=parseServerEnvironment(process.env,{database:true,jobs:true});
    if(!authenticateJobRequest(request,environment.jobSecret!))return problem(401,"unauthorized","Job authentication failed.",correlationId);
    return NextResponse.json(await new TransactionalEmailOperationsReader(getDatabasePool()).snapshot(),{headers:{"cache-control":"no-store","x-correlation-id":correlationId}});
  }catch{return problem(503,"job_unavailable","Transactional email telemetry is not configured.",correlationId);}
}

function problem(status: number, error: string, message: string,correlationId:string) { return NextResponse.json({error,message,correlationId}, { status, headers: { "cache-control":"no-store","x-correlation-id":correlationId } }); }
