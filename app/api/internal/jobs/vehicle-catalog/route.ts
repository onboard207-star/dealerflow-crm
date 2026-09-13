import { NextResponse } from "next/server";
import { AirtableCatalogExtractionError, extractAirtableVehicleCatalog, type AirtableCatalogSnapshot, validateVehicleCatalogManifest, VehicleCatalogProjectionService, VehicleCatalogValidationError } from "@/lib/application/vehicle-catalog";
import { parseServerEnvironment } from "@/lib/server/config";
import { getDatabasePool } from "@/lib/server/database";
import { authenticateJobRequest } from "@/lib/server/jobs";
import { PostgresVehicleCatalogProjectionProvider } from "@/lib/server/vehicles";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
export async function POST(request:Request){
  let environment;try{environment=parseServerEnvironment(process.env,{database:true,jobs:true});}catch{return problem(503,"job_unavailable","Vehicle catalog projection is not configured.");}
  if(environment.appEnvironment!=="staging")return problem(403,"environment_denied","Vehicle catalog projection is restricted to staging.");
  if(!authenticateJobRequest(request,environment.jobSecret!))return problem(401,"unauthorized","Job authentication failed.");
  try{const snapshot=snapshotValue(await request.json());const manifest=extractAirtableVehicleCatalog(snapshot);validateVehicleCatalogManifest(manifest);const report=evidence(snapshot,manifest.nodes);if(new URL(request.url).searchParams.get("dryRun")==="true")return NextResponse.json({dryRun:true,evidence:report},{headers:{"cache-control":"no-store"}});const result=await new VehicleCatalogProjectionService(new PostgresVehicleCatalogProjectionProvider(getDatabasePool())).project(manifest);return NextResponse.json({result,evidence:report},{headers:{"cache-control":"no-store"}});}
  catch(error){if(error instanceof SyntaxError)return problem(400,"invalid_json","Request body must be valid JSON.");if(error instanceof AirtableCatalogExtractionError||error instanceof VehicleCatalogValidationError)return NextResponse.json({error:"catalog_rejected",message:error.message,issues:error.issues},{status:422,headers:{"cache-control":"no-store"}});return problem(500,"job_failed","Vehicle catalog projection did not complete.");}
}
function snapshotValue(value:unknown):AirtableCatalogSnapshot{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new AirtableCatalogExtractionError(["Snapshot must be an object."]);const input=value as Record<string,unknown>;
  if(typeof input.baseId!=="string"||typeof input.revision!=="string"||!input.tables||typeof input.tables!=="object"||Array.isArray(input.tables))throw new AirtableCatalogExtractionError(["Snapshot baseId, revision, and tables are required."]);
  const tables:Record<string,Array<{id:string;fields:Readonly<Record<string,unknown>>}>>={};
  for(const[name,records]of Object.entries(input.tables as Record<string,unknown>)){if(!Array.isArray(records))throw new AirtableCatalogExtractionError([name+" must be an array."]);tables[name]=records.map((record,index)=>{if(!record||typeof record!=="object"||Array.isArray(record))throw new AirtableCatalogExtractionError([name+"["+index+"] must be an object."]);const candidate=record as Record<string,unknown>;if(typeof candidate.id!=="string"||!candidate.fields||typeof candidate.fields!=="object"||Array.isArray(candidate.fields))throw new AirtableCatalogExtractionError([name+"["+index+"] requires id and fields."]);return{id:candidate.id,fields:candidate.fields as Readonly<Record<string,unknown>>};});}
  return{baseId:input.baseId,revision:input.revision,tables};
}
function evidence(snapshot:AirtableCatalogSnapshot,nodes:readonly{readiness?:string;sourceRecordId?:string}[]){const sourceCounts=Object.fromEntries(Object.entries(snapshot.tables).map(([name,records])=>[name,records.length]));const readiness:Record<string,number>={};for(const node of nodes){const value=node.readiness??"not-declared";readiness[value]=(readiness[value]??0)+1;}return{sourceRevision:snapshot.revision,sourceCounts,projectedNodeCount:nodes.length,readiness,recordsWithProvenance:nodes.filter(node=>Boolean(node.sourceRecordId)).length};}
function problem(status:number,error:string,message:string){return NextResponse.json({error,message},{status,headers:{"cache-control":"no-store"}});}
