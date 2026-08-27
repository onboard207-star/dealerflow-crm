import type { Pool } from "pg";
import { withTenantDatabaseContext } from "@/lib/server/database";

export interface OperationalOverviewVisibility { leads:boolean; tasks:boolean; appointments:boolean; showroom:boolean; deals:boolean; inventory:boolean }
export interface OperationalOverview { activeLeads?:number; openTasks?:number; appointmentsToday?:number; activeShowroomVisits?:number; dealsPendingApproval?:number; availableInventory?:number }

export class OperationalOverviewReader {
  constructor(private readonly pool:Pool){}
  read(scope:{userId:string;organizationId:string;locationIds:readonly string[]|"all"},visibility:OperationalOverviewVisibility):Promise<OperationalOverview>{return withTenantDatabaseContext(this.pool,{userId:scope.userId,organizationId:scope.organizationId},async(client)=>{const all=scope.locationIds==="all";const locations=all?[]:scope.locationIds;const result=await client.query(`SELECT
        (SELECT count(*) FROM leads WHERE $4 AND organization_id=$1 AND ($2 OR location_id=ANY($3::text[])) AND status IN ('open','working','qualified'))::text active_leads,
        (SELECT count(*) FROM tasks WHERE $5 AND organization_id=$1 AND ($2 OR location_id=ANY($3::text[])) AND status IN ('open','in-progress'))::text open_tasks,
        (SELECT count(*) FROM appointments a LEFT JOIN locations l ON l.organization_id=a.organization_id AND l.id=a.location_id WHERE $6 AND a.organization_id=$1 AND ($2 OR a.location_id=ANY($3::text[])) AND a.status IN ('scheduled','confirmed','arrived') AND (a.starts_at AT TIME ZONE COALESCE(l.timezone,'UTC'))::date=(now() AT TIME ZONE COALESCE(l.timezone,'UTC'))::date)::text appointments_today,
        (SELECT count(*) FROM showroom_visits WHERE $7 AND organization_id=$1 AND ($2 OR location_id=ANY($3::text[])) AND status IN ('checked-in','active'))::text active_showroom_visits,
        (SELECT count(*) FROM deals WHERE $8 AND organization_id=$1 AND ($2 OR location_id=ANY($3::text[])) AND status='pending-approval')::text deals_pending_approval,
        (SELECT count(*) FROM inventory_units WHERE $9 AND organization_id=$1 AND ($2 OR location_id=ANY($3::text[])) AND status='available')::text available_inventory`,[scope.organizationId,all,locations,visibility.leads,visibility.tasks,visibility.appointments,visibility.showroom,visibility.deals,visibility.inventory]) as {rows:Array<{active_leads:string;open_tasks:string;appointments_today:string;active_showroom_visits:string;deals_pending_approval:string;available_inventory:string}>};const row=result.rows[0]!;return{...(visibility.leads?{activeLeads:Number(row.active_leads)}:{}),...(visibility.tasks?{openTasks:Number(row.open_tasks)}:{}),...(visibility.appointments?{appointmentsToday:Number(row.appointments_today)}:{}),...(visibility.showroom?{activeShowroomVisits:Number(row.active_showroom_visits)}:{}),...(visibility.deals?{dealsPendingApproval:Number(row.deals_pending_approval)}:{}),...(visibility.inventory?{availableInventory:Number(row.available_inventory)}:{})};});}
}
