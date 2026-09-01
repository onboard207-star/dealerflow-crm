import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ImportBatchConflictError, ImportBatchNotFoundError, ImportBatchService, ImportBatchValidationError } from "@/lib/application/launch";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresImportBatchProvider } from "@/lib/server/launch";

export const runtime="nodejs";export const dynamic="force-dynamic";
interface RouteContext{params:Promise<{organizationId:string;batchId:string}>}

export async function POST(request:Request,context:RouteContext){
  try{
    const{organizationId,batchId}=await context.params;const body=object(await request.json());const idempotencyKey=request.headers.get("idempotency-key")?.trim()??"";
    const pool=getDatabasePool(),actor=await authenticateOrganizationRequest(request,organizationId,new PostgresMembershipReader(pool));
    const result=await new ImportBatchService(new PostgresImportBatchProvider(pool,{userId:actor.userId,organizationId})).reverse({actor,organizationId,batchId,idempotencyKey,confirmation:string(body.confirmation),reason:string(body.reason)});
    return NextResponse.json(result,{headers:{"cache-control":"no-store","x-correlation-id":correlation(request)}});
  }catch(error){return failure(error);}
}

function object(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))throw new ImportBatchValidationError(["Request data must be an object."]);return value as Record<string,unknown>}
function string(value:unknown){return typeof value==="string"?value:""}
function correlation(request:Request){return request.headers.get("x-correlation-id")?.trim()||`req_${randomUUID()}`}
function failure(error:unknown){if(error instanceof SyntaxError)return problem(400,"invalid_request","Request JSON is invalid.");if(error instanceof ImportBatchValidationError)return NextResponse.json({error:"invalid_request",message:error.message,issues:error.issues},{status:400,headers:{"cache-control":"no-store"}});if(error instanceof AuthenticationError)return problem(401,"unauthorized",error.message);if(error instanceof MembershipError||error instanceof AuthorizationError)return problem(403,"forbidden","You do not have permission to reverse imports.");if(error instanceof ImportBatchNotFoundError)return problem(404,"not_found",error.message);if(error instanceof ImportBatchConflictError)return problem(409,"conflict",error.message);return problem(500,"internal_error","The import batch could not be reversed.")}
function problem(status:number,error:string,message:string){return NextResponse.json({error,message},{status,headers:{"cache-control":"no-store"}})}
