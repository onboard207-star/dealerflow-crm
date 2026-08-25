import { NextResponse } from "next/server";
import { InvitationOperationError, ManageInvitationsService } from "@/lib/application/organizations";
import { AuthorizationError } from "@/lib/platform/auth";
import { AuthenticationError, MembershipError, PostgresMembershipReader, authenticateOrganizationRequest } from "@/lib/server/auth";
import { parseServerEnvironment } from "@/lib/server/config";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresInvitationProvider } from "@/lib/server/organizations";

export const runtime="nodejs"; export const dynamic="force-dynamic";
interface Context{params:Promise<{organizationId:string;invitationId:string}>}
export async function DELETE(request:Request,context:Context){return operate(request,context,"revoke");}
export async function POST(request:Request,context:Context){return operate(request,context,"resend");}
async function operate(request:Request,context:Context,operation:"revoke"|"resend"){
  try{const{organizationId,invitationId}=await context.params;const pool=getDatabasePool();const actor=await authenticateOrganizationRequest(request,organizationId,new PostgresMembershipReader(pool));const environment=parseServerEnvironment(process.env,{authentication:true});const service=new ManageInvitationsService(new PostgresInvitationProvider(pool,environment.authUrl!));await service[operation](actor,organizationId,invitationId);return NextResponse.json({status:operation==="revoke"?"revoked":"resent"},{headers:{"cache-control":"no-store"}});}
  catch(error){if(error instanceof AuthenticationError)return problem(401,"unauthorized",error.message);if(error instanceof MembershipError||error instanceof AuthorizationError)return problem(403,"forbidden","Staff invitations are not permitted.");if(error instanceof InvitationOperationError)return problem(409,"invitation_conflict",error.message);return problem(500,"internal_error","The invitation operation failed.");}
}
function problem(status:number,error:string,message:string){return NextResponse.json({error,message},{status,headers:{"cache-control":"no-store"}});}
