import { previewImport, type ImportBatch, type ImportBatchProvider, type ImportDomain, type ImportPreviewIssue, type ImportPreviewRow, type ImportSourceRow } from "@/lib/application/launch";
import { generateEntityId } from "@/lib/core/identifiers";
import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

type BatchRow = { id:string; organization_id:string; domain:ImportBatch["domain"]; source_name:string; source_checksum:string; mapping:Record<string,string>; status:ImportBatch["status"]; total_rows:number; valid_rows:number; rejected_rows:number; duplicate_rows:number; unresolved_rows:number; idempotency_key:string; created_by:string; created_at:Date };
type DetailRow = { row_number:number; status:ImportPreviewRow["status"]; canonical:Record<string,string|number|boolean>; issues:ImportPreviewIssue[] };

export class PostgresImportBatchProvider implements ImportBatchProvider {
  constructor(private readonly pool: DatabasePool, private readonly tenant: { userId: string; organizationId: string }) {}

  findByIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<ImportBatch | null> {
    return withTenantDatabaseContext(this.pool, this.context(organizationId), async (client) => {
      const result = await client.query("SELECT id,organization_id,domain,source_name,source_checksum,mapping,status,total_rows,valid_rows,rejected_rows,duplicate_rows,unresolved_rows,idempotency_key,created_by,created_at FROM import_batches WHERE organization_id=$1 AND idempotency_key=$2", [organizationId,idempotencyKey]) as {rows:BatchRow[]};
      return result.rows[0] ? this.hydrate(client, result.rows[0]) : null;
    });
  }

  create(batch: ImportBatch): Promise<ImportBatch> {
    return withTenantDatabaseContext(this.pool, this.context(batch.organizationId), async (client) => {
      const inserted=await client.query(`INSERT INTO import_batches(id,organization_id,domain,source_name,source_checksum,mapping,status,total_rows,valid_rows,rejected_rows,duplicate_rows,unresolved_rows,idempotency_key,created_by,created_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(organization_id,idempotency_key) DO NOTHING RETURNING id`, [batch.id,batch.organizationId,batch.domain,batch.sourceName,batch.sourceChecksum,JSON.stringify(batch.mapping),batch.status,batch.preview.totalRows,batch.preview.validRows,batch.preview.rejectedRows,batch.preview.duplicateRows,batch.preview.unresolvedRows,batch.idempotencyKey,batch.createdBy,batch.createdAt]) as {rows:Array<{id:string}>};
      if(!inserted.rows[0]){
        const existing=await client.query("SELECT id,organization_id,domain,source_name,source_checksum,mapping,status,total_rows,valid_rows,rejected_rows,duplicate_rows,unresolved_rows,idempotency_key,created_by,created_at FROM import_batches WHERE organization_id=$1 AND idempotency_key=$2",[batch.organizationId,batch.idempotencyKey]) as {rows:BatchRow[]};
        if(!existing.rows[0])throw new Error("Concurrent import batch could not be reconciled.");
        return this.hydrate(client,existing.rows[0]);
      }
      for (const row of batch.preview.rows) await client.query("INSERT INTO import_batch_rows(id,organization_id,batch_id,row_number,status,canonical,issues) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)", [generateEntityId("imr"),batch.organizationId,batch.id,rowNumber(row),row.status,JSON.stringify(row.canonical),JSON.stringify(row.issues)]);
      await client.query("INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,new_values) VALUES($1,$2,$3,'import.batch_staged','import-batch',$4,'application',$5,$6::jsonb)", [generateEntityId("aud"),batch.organizationId,batch.createdBy,batch.id,batch.idempotencyKey,JSON.stringify({domain:batch.domain,status:batch.status,totalRows:batch.preview.totalRows})]);
      return batch;
    });
  }

  private context(organizationId:string) { if (organizationId!==this.tenant.organizationId) throw new Error("Import provider tenant mismatch."); return this.tenant; }
  private async hydrate(client:{query(query:string,values?:readonly unknown[]):Promise<unknown>}, batch:BatchRow):Promise<ImportBatch> {
    const result=await client.query("SELECT row_number,status,canonical,issues FROM import_batch_rows WHERE organization_id=$1 AND batch_id=$2 ORDER BY row_number",[batch.organization_id,batch.id]) as {rows:DetailRow[]};
    return {id:batch.id,organizationId:batch.organization_id,domain:batch.domain,sourceName:batch.source_name,sourceChecksum:batch.source_checksum,mapping:batch.mapping,status:batch.status,idempotencyKey:batch.idempotency_key,createdBy:batch.created_by,createdAt:batch.created_at.toISOString(),preview:{domain:batch.domain,totalRows:batch.total_rows,validRows:batch.valid_rows,rejectedRows:batch.rejected_rows,duplicateRows:batch.duplicate_rows,unresolvedRows:batch.unresolved_rows,rows:result.rows.map(row=>({rowNumber:row.row_number,status:row.status,canonical:row.canonical,issues:row.issues}))}};
  }
}
function rowNumber(row: ImportPreviewRow) { return row.rowNumber; }

export async function loadImportPreflight(pool:DatabasePool,tenant:{userId:string;organizationId:string},input:{domain:ImportDomain;mapping:Readonly<Record<string,string>>;rows:readonly ImportSourceRow[]}) {
  return withTenantDatabaseContext(pool,tenant,async client=>{
    const roleResult=await client.query("SELECT key FROM roles WHERE organization_id=$1",[tenant.organizationId]) as {rows:Array<{key:string}>};
    const approvedRoleKeys=new Set(roleResult.rows.map(row=>row.key));
    const preview=previewImport({...input,approvedRoleKeys});
    const values=preview.rows.map(row=>row.canonical);
    const keys=new Set<string>();
    if(input.domain==="customer-lead"){
      const emails=values.flatMap(row=>typeof row.email==="string"?[row.email]:[]),phones=values.flatMap(row=>typeof row.phone==="string"?[row.phone]:[]);
      const result=await client.query("SELECT normalized_email,normalized_phone FROM customers WHERE organization_id=$1 AND (normalized_email=ANY($2::text[]) OR normalized_phone=ANY($3::text[]))",[tenant.organizationId,emails,phones]) as {rows:Array<{normalized_email:string|null;normalized_phone:string|null}>};
      result.rows.forEach(row=>{if(row.normalized_email)keys.add(`customer:email:${row.normalized_email}`);if(row.normalized_phone)keys.add(`customer:phone:${row.normalized_phone}`);});
    }else if(input.domain==="inventory"){
      const vins=values.flatMap(row=>typeof row.vin==="string"?[row.vin]:[]),stocks=values.flatMap(row=>typeof row.stockNumber==="string"?[row.stockNumber]:[]);
      const result=await client.query("SELECT vehicle.vin,unit.stock_number,unit.location_id FROM inventory_units unit JOIN vehicles vehicle ON vehicle.organization_id=unit.organization_id AND vehicle.id=unit.vehicle_id WHERE unit.organization_id=$1 AND (vehicle.vin=ANY($2::text[]) OR unit.stock_number=ANY($3::text[]))",[tenant.organizationId,vins,stocks]) as {rows:Array<{vin:string;stock_number:string;location_id:string}>};
      result.rows.forEach(row=>{keys.add(`inventory:vin:${row.vin}`);keys.add(`inventory:stock:${row.location_id}:${row.stock_number}`);});
    }else{
      const emails=values.flatMap(row=>typeof row.email==="string"?[row.email]:[]);
      const result=await client.query("SELECT lower(user_account.email) email FROM organization_memberships membership JOIN users user_account ON user_account.id=membership.user_id WHERE membership.organization_id=$1 AND lower(user_account.email)=ANY($2::text[])",[tenant.organizationId,emails]) as {rows:Array<{email:string}>};
      result.rows.forEach(row=>keys.add(`user:email:${row.email}`));
    }
    return{existingIdentityKeys:keys,approvedRoleKeys};
  });
}
