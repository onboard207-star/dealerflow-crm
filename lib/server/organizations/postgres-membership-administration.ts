import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { MembershipAdministrationProvider, MembershipMutationResult, ManagedMembershipStatus } from "@/lib/application/organizations";
import { generateEntityId } from "@/lib/core/identifiers";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresMembershipAdministration implements MembershipAdministrationProvider {
  constructor(private readonly pool: Pool) {}
  updateAccess(input: { actorId:string; organizationId:string; membershipId:string; roleIds:readonly string[]; locationIds:readonly string[]; allLocations:boolean }) {
    return withTenantDatabaseContext(this.pool,{userId:input.actorId,organizationId:input.organizationId},async(client)=>{
      const target=await lockTarget(client as PoolClient,input); if(target!=="updated") return target;
      if(!await validSelection(client as PoolClient,input)) return "invalid_scope";
      if(await removesLastManager(client as PoolClient,input.organizationId,input.membershipId,input.roleIds)) return "last_manager";
      await client.query("UPDATE organization_memberships SET all_locations=$3,updated_at=now() WHERE organization_id=$1 AND id=$2",[input.organizationId,input.membershipId,input.allLocations]);
      await client.query("DELETE FROM membership_roles WHERE organization_id=$1 AND membership_id=$2",[input.organizationId,input.membershipId]);
      await client.query("INSERT INTO membership_roles(membership_id,organization_id,role_id) SELECT $2,$1,unnest($3::text[])",[input.organizationId,input.membershipId,input.roleIds]);
      await client.query("DELETE FROM membership_locations WHERE organization_id=$1 AND membership_id=$2",[input.organizationId,input.membershipId]);
      if(!input.allLocations) await client.query("INSERT INTO membership_locations(membership_id,organization_id,location_id) SELECT $2,$1,unnest($3::text[])",[input.organizationId,input.membershipId,input.locationIds]);
      await audit(client as PoolClient,input,"organization.membership.access_updated",{allLocations:input.allLocations,roleIds:input.roleIds,locationIds:input.allLocations?[]:input.locationIds}); return "updated";
    });
  }
  updateStatus(input: { actorId:string; organizationId:string; membershipId:string; status:ManagedMembershipStatus }) {
    return withTenantDatabaseContext(this.pool,{userId:input.actorId,organizationId:input.organizationId},async(client)=>{
      const target=await lockTarget(client as PoolClient,input); if(target!=="updated") return target;
      if(input.status!=="active"&&await removesLastManager(client as PoolClient,input.organizationId,input.membershipId,[])) return "last_manager";
      await client.query("UPDATE organization_memberships SET status=$3,updated_at=now() WHERE organization_id=$1 AND id=$2",[input.organizationId,input.membershipId,input.status]);
      await audit(client as PoolClient,input,`organization.membership.${input.status}`,{status:input.status}); return "updated";
    });
  }
}

async function lockTarget(client:PoolClient,input:{actorId:string;organizationId:string;membershipId:string}):Promise<MembershipMutationResult>{const result=await client.query<{user_id:string}>("SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND id=$2 FOR UPDATE",[input.organizationId,input.membershipId]);if(!result.rows[0])return "not_found";return result.rows[0].user_id===input.actorId?"self_change":"updated";}
async function validSelection(client:PoolClient,input:{organizationId:string;roleIds:readonly string[];locationIds:readonly string[];allLocations:boolean}){const result=await client.query<{valid:boolean}>("SELECT (SELECT count(*) FROM roles WHERE organization_id=$1 AND id=ANY($2::text[]))=cardinality($2::text[]) AND ($3 OR (SELECT count(*) FROM locations WHERE organization_id=$1 AND active=true AND id=ANY($4::text[]))=cardinality($4::text[])) valid",[input.organizationId,input.roleIds,input.allLocations,input.locationIds]);return result.rows[0]?.valid===true;}
async function removesLastManager(client:PoolClient,organizationId:string,membershipId:string,nextRoleIds:readonly string[]){const target=await client.query<{manager:boolean}>("SELECT EXISTS(SELECT 1 FROM membership_roles mr JOIN role_capabilities rc ON rc.organization_id=mr.organization_id AND rc.role_id=mr.role_id WHERE mr.organization_id=$1 AND mr.membership_id=$2 AND rc.capability='staff.manage') manager",[organizationId,membershipId]);if(!target.rows[0]?.manager)return false;if(nextRoleIds.length){const replacement=await client.query<{manager:boolean}>("SELECT EXISTS(SELECT 1 FROM role_capabilities WHERE organization_id=$1 AND role_id=ANY($2::text[]) AND capability='staff.manage') manager",[organizationId,nextRoleIds]);if(replacement.rows[0]?.manager)return false;}const others=await client.query<{count:string}>("SELECT count(DISTINCT m.id)::text count FROM organization_memberships m JOIN membership_roles mr ON mr.organization_id=m.organization_id AND mr.membership_id=m.id JOIN role_capabilities rc ON rc.organization_id=mr.organization_id AND rc.role_id=mr.role_id AND rc.capability='staff.manage' WHERE m.organization_id=$1 AND m.status='active' AND m.id<>$2",[organizationId,membershipId]);return Number(others.rows[0]?.count??0)===0;}
async function audit(client:PoolClient,input:{actorId:string;organizationId:string;membershipId:string},action:string,values:unknown){await client.query("INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,new_values) VALUES($1,$2,$3,$4,'organization_membership',$5,'application',$6,$7::jsonb)",[generateEntityId("aud"),input.organizationId,input.actorId,action,input.membershipId,`membership:${randomUUID()}`,JSON.stringify(values)]);}
