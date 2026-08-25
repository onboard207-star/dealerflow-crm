import { createHash } from "node:crypto";
import type { DatabasePool } from "@/lib/server/database";

export async function isInvitationSignupAllowed(pool: DatabasePool,input:{email:string;callbackURL?:unknown}):Promise<boolean>{
  const email=input.email.trim().toLowerCase();const token=invitationToken(input.callbackURL);
  if(!token||!/^\S+@\S+\.\S+$/.test(email))return false;const organizationId=token.split(".",1)[0]??"";
  if(!/^org_[a-z0-9_-]{6,64}$/.test(organizationId)||token.length>180)return false;
  const tokenHash=createHash("sha256").update(token).digest("hex");const client=await pool.connect();
  try{await client.query("BEGIN READ ONLY");await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.invitation_token_hash',$2,true),set_config('app.invitation_signup_email',$3,true)",[organizationId,tokenHash,email]);const result=await client.query("SELECT 1 FROM organization_invitations WHERE organization_id=$1 AND token_hash=$2 AND lower(email)=lower($3) AND status='pending' AND expires_at>now() LIMIT 1",[organizationId,tokenHash,email])as{rows?:unknown[]};await client.query("COMMIT");return Boolean(result.rows?.[0]);}
  catch{try{await client.query("ROLLBACK");}catch{}return false;}finally{client.release();}
}
function invitationToken(callbackURL:unknown){if(typeof callbackURL!=="string"||callbackURL.length>512)return;try{const url=new URL(callbackURL,"https://dealerflow.invalid");if(url.origin!=="https://dealerflow.invalid"||url.pathname!=="/accept-invitation")return;return url.searchParams.get("token")??undefined;}catch{return;}}
