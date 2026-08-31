import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ImportBatchService, ImportBatchValidationError, importDomains, type ImportDomain, type ImportSourceRow } from "@/lib/application/launch";
import { AuthorizationError, assertAuthorized } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresImportBatchProvider, loadImportPreflight } from "@/lib/server/launch";

export const runtime="nodejs"; export const dynamic="force-dynamic";
interface RouteContext{params:Promise<{organizationId:string}>}

export async function POST(request:Request,context:RouteContext){
  try{
    const contentLength=Number(request.headers.get("content-length")??0);if(contentLength>5_000_000)return problem(413,"payload_too_large","Import staging requests are limited to 5 MB.");
    const{organizationId}=await context.params;if(!/^org_[a-z0-9_-]{6,64}$/.test(organizationId))return problem(400,"invalid_request","Organization ID is invalid.");
    const body=object(await request.json());const domain=domainValue(body.domain),sourceName=string(body.sourceName),mapping=stringRecord(body.mapping),rows=sourceRows(body.rows);
    const idempotencyKey=request.headers.get("idempotency-key")?.trim();if(!idempotencyKey)return problem(400,"invalid_request","Idempotency-Key is required.");
    const pool=getDatabasePool(),actor=await authenticateOrganizationRequest(request,organizationId,new PostgresMembershipReader(pool));assertAuthorized(actor,{organizationId,capability:"organization.configure"});
    const preflight=await loadImportPreflight(pool,{userId:actor.userId,organizationId},{domain,mapping,rows});
    const sourceChecksum=createHash("sha256").update(JSON.stringify(rows)).digest("hex");if(typeof body.sourceChecksum==="string"&&body.sourceChecksum.trim().toLowerCase()!==sourceChecksum)throw new ImportBatchValidationError(["Source checksum does not match the submitted rows."]);
    const batch=await new ImportBatchService(new PostgresImportBatchProvider(pool,{userId:actor.userId,organizationId})).stage({actor,organizationId,domain,sourceName,sourceChecksum,mapping,rows,idempotencyKey,existingIdentityKeys:preflight.existingIdentityKeys,approvedRoleKeys:preflight.approvedRoleKeys});
    return NextResponse.json(batch,{status:201,headers:{"cache-control":"no-store","x-correlation-id":request.headers.get("x-correlation-id")?.trim()||`req_${randomUUID()}`}});
  }catch(error){if(error instanceof SyntaxError||error instanceof ImportBatchValidationError)return NextResponse.json({error:"invalid_request",message:error.message,issues:error instanceof ImportBatchValidationError?error.issues:undefined},{status:400,headers:{"cache-control":"no-store"}});if(error instanceof AuthenticationError)return problem(401,"unauthorized",error.message);if(error instanceof MembershipError||error instanceof AuthorizationError)return problem(403,"forbidden","You do not have permission to stage imports.");return problem(500,"internal_error","The import batch could not be staged.");}
}
function object(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))throw new ImportBatchValidationError(["Request data must be an object."]);return value as Record<string,unknown>}
function string(value:unknown){return typeof value==="string"?value:""}
function domainValue(value:unknown):ImportDomain{if(typeof value==="string"&&(importDomains as readonly string[]).includes(value))return value as ImportDomain;throw new ImportBatchValidationError(["Import domain is invalid."])}
function stringRecord(value:unknown){const record=object(value);if(Object.values(record).some(item=>typeof item!=="string"))throw new ImportBatchValidationError(["Mapping values must be canonical field names."]);return record as Record<string,string>}
function sourceRows(value:unknown):ImportSourceRow[]{if(!Array.isArray(value))throw new ImportBatchValidationError(["Rows must be an array."]);if(!value.length||value.length>10_000)throw new ImportBatchValidationError(["A batch must contain between 1 and 10,000 rows."]);return value.map((row,index)=>{const record=object(row);if(Object.values(record).some(item=>item!==null&&item!==undefined&&!['string','number','boolean'].includes(typeof item)))throw new ImportBatchValidationError([`Row ${index+1} contains an unsupported value.`]);return record as ImportSourceRow})}
function problem(status:number,error:string,message:string){return NextResponse.json({error,message},{status,headers:{"cache-control":"no-store"}})}
