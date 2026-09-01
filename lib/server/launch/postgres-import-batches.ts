import { ImportBatchConflictError, ImportBatchNotFoundError, previewImport, type ImportBatch, type ImportBatchExecution, type ImportBatchProvider, type ImportDomain, type ImportPreviewIssue, type ImportPreviewRow, type ImportSourceRow } from "@/lib/application/launch";
import { generateEntityId } from "@/lib/core/identifiers";
import { withTenantDatabaseContext, type DatabaseClient, type DatabasePool } from "@/lib/server/database";

type BatchRow = { id:string; organization_id:string; domain:ImportBatch["domain"]; source_name:string; source_checksum:string; mapping:Record<string,string>; status:ImportBatch["status"]; total_rows:number; valid_rows:number; rejected_rows:number; duplicate_rows:number; unresolved_rows:number; idempotency_key:string; created_by:string; created_at:Date; completed_at:Date|null };
type DetailRow = { row_number:number; status:ImportPreviewRow["status"]; canonical:Record<string,string|number|boolean>; issues:ImportPreviewIssue[] };
type AppliedRow = { row_number:number; entity_kind:"customer"|"lead"|"vehicle"|"inventory-unit"; entity_id:string; reversed_at:Date|null };

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

  commit(input:{organizationId:string;batchId:string;actorId:string;idempotencyKey:string}):Promise<ImportBatchExecution>{
    return withTenantDatabaseContext(this.pool,this.context(input.organizationId),async client=>{
      const batch=await lockBatch(client,input.organizationId,input.batchId);
      if(!batch)throw new ImportBatchNotFoundError();
      await assertControlledTenant(client,input.organizationId);
      if(batch.status==="completed")return executionSummary(client,batch,"completed");
      if(batch.status!=="ready")throw new ImportBatchConflictError(`Only a ready import batch can be committed; current status is ${batch.status}.`);
      if(batch.domain==="user")throw new ImportBatchConflictError("User access imports must use the reviewed invitation workflow.");
      const rows=await queryRows<DetailRow>(client,"SELECT row_number,status,canonical,issues FROM import_batch_rows WHERE organization_id=$1 AND batch_id=$2 ORDER BY row_number FOR UPDATE",[input.organizationId,input.batchId]);
      if(rows.some(row=>row.status!=="valid")||rows.length!==batch.valid_rows)throw new ImportBatchConflictError("The staged batch no longer matches a fully valid ready preview.");
      for(const row of rows){
        if(batch.domain==="customer-lead")await applyCustomerLead(client,batch,row,input.actorId);
        else await applyInventory(client,batch,row,input.actorId);
      }
      const completedAt=new Date();
      await client.query("UPDATE import_batches SET status='completed',completed_at=$3 WHERE organization_id=$1 AND id=$2 AND status='ready'",[input.organizationId,input.batchId,completedAt]);
      await audit(client,{organizationId:input.organizationId,actorId:input.actorId,batchId:input.batchId,action:"import.batch_committed",correlationId:input.idempotencyKey,values:{domain:batch.domain,appliedRows:rows.length}});
      return executionSummary(client,{...batch,status:"completed",completed_at:completedAt},"completed");
    });
  }

  reverse(input:{organizationId:string;batchId:string;actorId:string;idempotencyKey:string;reason:string}):Promise<ImportBatchExecution>{
    return withTenantDatabaseContext(this.pool,this.context(input.organizationId),async client=>{
      const batch=await lockBatch(client,input.organizationId,input.batchId);
      if(!batch)throw new ImportBatchNotFoundError();
      await assertControlledTenant(client,input.organizationId);
      if(batch.status==="reversed")return executionSummary(client,batch,"reversed");
      if(batch.status!=="completed")throw new ImportBatchConflictError(`Only a completed import batch can be reversed; current status is ${batch.status}.`);
      const applied=await queryRows<AppliedRow>(client,"SELECT row_number,entity_kind,entity_id,reversed_at FROM import_applied_records WHERE organization_id=$1 AND batch_id=$2 ORDER BY CASE entity_kind WHEN 'lead' THEN 1 WHEN 'inventory-unit' THEN 1 WHEN 'customer' THEN 2 WHEN 'vehicle' THEN 2 ELSE 3 END,row_number DESC FOR UPDATE",[input.organizationId,input.batchId]);
      if(!applied.length||applied.some(record=>record.reversed_at))throw new ImportBatchConflictError("Import applied-record evidence is missing or already partially reversed.");
      for(const record of applied)await deleteAppliedEntity(client,input.organizationId,record);
      const reversedAt=new Date();
      await client.query("UPDATE import_applied_records SET reversed_at=$3,reversed_by=$4 WHERE organization_id=$1 AND batch_id=$2 AND reversed_at IS NULL",[input.organizationId,input.batchId,reversedAt,input.actorId]);
      await client.query("UPDATE import_batches SET status='reversed' WHERE organization_id=$1 AND id=$2 AND status='completed'",[input.organizationId,input.batchId]);
      await audit(client,{organizationId:input.organizationId,actorId:input.actorId,batchId:input.batchId,action:"import.batch_reversed",correlationId:input.idempotencyKey,values:{domain:batch.domain,reason:input.reason,appliedRows:new Set(applied.map(record=>record.row_number)).size}});
      return executionSummary(client,{...batch,status:"reversed"},"reversed",reversedAt);
    });
  }

  private context(organizationId:string) { if (organizationId!==this.tenant.organizationId) throw new Error("Import provider tenant mismatch."); return this.tenant; }
  private async hydrate(client:{query(query:string,values?:readonly unknown[]):Promise<unknown>}, batch:BatchRow):Promise<ImportBatch> {
    const result=await client.query("SELECT row_number,status,canonical,issues FROM import_batch_rows WHERE organization_id=$1 AND batch_id=$2 ORDER BY row_number",[batch.organization_id,batch.id]) as {rows:DetailRow[]};
    return {id:batch.id,organizationId:batch.organization_id,domain:batch.domain,sourceName:batch.source_name,sourceChecksum:batch.source_checksum,mapping:batch.mapping,status:batch.status,idempotencyKey:batch.idempotency_key,createdBy:batch.created_by,createdAt:batch.created_at.toISOString(),preview:{domain:batch.domain,totalRows:batch.total_rows,validRows:batch.valid_rows,rejectedRows:batch.rejected_rows,duplicateRows:batch.duplicate_rows,unresolvedRows:batch.unresolved_rows,rows:result.rows.map(row=>({rowNumber:row.row_number,status:row.status,canonical:row.canonical,issues:row.issues}))}};
  }
}
function rowNumber(row: ImportPreviewRow) { return row.rowNumber; }

async function lockBatch(client:DatabaseClient,organizationId:string,batchId:string){
  const rows=await queryRows<BatchRow>(client,"SELECT id,organization_id,domain,source_name,source_checksum,mapping,status,total_rows,valid_rows,rejected_rows,duplicate_rows,unresolved_rows,idempotency_key,created_by,created_at,completed_at FROM import_batches WHERE organization_id=$1 AND id=$2 FOR UPDATE",[organizationId,batchId]);
  return rows[0]??null;
}

async function applyCustomerLead(client:DatabaseClient,batch:BatchRow,row:DetailRow,actorId:string){
  const value=row.canonical,customerId=generateEntityId("cus"),leadId=generateEntityId("led");
  const assignedUserId=stringValue(value.assignedEmployeeId),locationId=stringValue(value.locationId),email=stringValue(value.email),phone=stringValue(value.phone);
  await acquireLocks(client,[email?`${batch.organization_id}:customer:identity:email:${email}`:null,phone?`${batch.organization_id}:customer:identity:phone:${phone}`:null].filter((item):item is string=>Boolean(item)));
  const locations=await queryRows<{exists:boolean}>(client,"SELECT true exists FROM locations WHERE organization_id=$1 AND id=$2 AND active=true",[batch.organization_id,locationId]);if(!locations[0])throw new ImportBatchConflictError(`Row ${row.row_number} references an unavailable location.`);
  const duplicates=await queryRows<{exists:boolean}>(client,"SELECT true exists FROM customers WHERE organization_id=$1 AND (($2::text IS NOT NULL AND normalized_email=$2) OR ($3::text IS NOT NULL AND normalized_phone=$3)) LIMIT 1",[batch.organization_id,email,phone]);if(duplicates[0])throw new ImportBatchConflictError(`Row ${row.row_number} duplicates an existing customer identity.`);
  if(assignedUserId){const members=await queryRows<{exists:boolean}>(client,"SELECT true exists FROM organization_memberships membership WHERE membership.organization_id=$1 AND membership.user_id=$2 AND membership.status='active' AND (membership.all_locations OR EXISTS(SELECT 1 FROM membership_locations grant_record WHERE grant_record.organization_id=membership.organization_id AND grant_record.membership_id=membership.id AND grant_record.location_id=$3))",[batch.organization_id,assignedUserId,locationId]);if(!members[0])throw new ImportBatchConflictError(`Row ${row.row_number} references an employee without location access.`);}
  await client.query("INSERT INTO customers(id,organization_id,location_id,display_name,email,normalized_email,phone,normalized_phone,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5,$6,$6,'active',$7,$7)",[customerId,batch.organization_id,locationId,stringValue(value.displayName),email,phone,actorId]);
  await client.query("INSERT INTO leads(id,organization_id,location_id,customer_id,assigned_user_id,source,stage,status,idempotency_key,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,'new','open',$7,$8,$8)",[leadId,batch.organization_id,locationId,customerId,assignedUserId,stringValue(value.leadSource)||"import",`import:${batch.id}:${row.row_number}:lead`,actorId]);
  await appliedRecord(client,batch.organization_id,batch.id,row.row_number,"customer",customerId);
  await appliedRecord(client,batch.organization_id,batch.id,row.row_number,"lead",leadId);
}

async function applyInventory(client:DatabaseClient,batch:BatchRow,row:DetailRow,actorId:string){
  const value=row.canonical,vehicleId=generateEntityId("veh"),inventoryId=generateEntityId("inv"),locationId=stringValue(value.locationId);
  await acquireLocks(client,[`${batch.organization_id}:inventory:vin:${stringValue(value.vin)}`,`${batch.organization_id}:inventory:stock:${stringValue(value.stockNumber)}`]);
  const locations=await queryRows<{exists:boolean}>(client,"SELECT true exists FROM locations WHERE organization_id=$1 AND id=$2 AND active=true",[batch.organization_id,locationId]);
  if(!locations[0])throw new ImportBatchConflictError(`Row ${row.row_number} references an unavailable location.`);
  const duplicates=await queryRows<{exists:boolean}>(client,"SELECT true exists FROM inventory_units unit JOIN vehicles vehicle ON vehicle.organization_id=unit.organization_id AND vehicle.id=unit.vehicle_id WHERE unit.organization_id=$1 AND (vehicle.vin=$2 OR unit.stock_number=$3) LIMIT 1",[batch.organization_id,stringValue(value.vin),stringValue(value.stockNumber)]);if(duplicates[0])throw new ImportBatchConflictError(`Row ${row.row_number} duplicates an existing VIN or stock number.`);
  await client.query("INSERT INTO vehicles(id,organization_id,vin,year,make,model,trim,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)",[vehicleId,batch.organization_id,stringValue(value.vin),numberValue(value.year),stringValue(value.make),stringValue(value.model),stringValue(value.trim),actorId]);
  await client.query("INSERT INTO inventory_units(id,organization_id,location_id,vehicle_id,stock_number,idempotency_key,status,list_price_cents,acquired_at,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$9)",[inventoryId,batch.organization_id,locationId,vehicleId,stringValue(value.stockNumber),`import:${batch.id}:${row.row_number}:inventory`,value.status==="unavailable"?"unavailable":"available",numberValue(value.priceCents),actorId]);
  await appliedRecord(client,batch.organization_id,batch.id,row.row_number,"vehicle",vehicleId);
  await appliedRecord(client,batch.organization_id,batch.id,row.row_number,"inventory-unit",inventoryId);
}

async function appliedRecord(client:DatabaseClient,organizationId:string,batchId:string,rowNumberValue:number,entityKind:AppliedRow["entity_kind"],entityId:string){
  await client.query("INSERT INTO import_applied_records(id,organization_id,batch_id,row_number,entity_kind,entity_id) VALUES($1,$2,$3,$4,$5,$6)",[generateEntityId("iar"),organizationId,batchId,rowNumberValue,entityKind,entityId]);
}

async function deleteAppliedEntity(client:DatabaseClient,organizationId:string,record:AppliedRow){
  const table={lead:"leads","inventory-unit":"inventory_units",customer:"customers",vehicle:"vehicles"}[record.entity_kind];
  const result=await client.query(`DELETE FROM ${table} WHERE organization_id=$1 AND id=$2 RETURNING id`,[organizationId,record.entity_id]) as {rows:Array<{id:string}>};
  if(!result.rows[0])throw new ImportBatchConflictError(`Applied ${record.entity_kind} record ${record.entity_id} is missing; reversal stopped.`);
}

async function executionSummary(client:DatabaseClient,batch:BatchRow,status:"completed"|"reversed",occurredAt?:Date):Promise<ImportBatchExecution>{
  const applied=await queryRows<AppliedRow>(client,"SELECT row_number,entity_kind,entity_id,reversed_at FROM import_applied_records WHERE organization_id=$1 AND batch_id=$2 ORDER BY row_number,entity_kind",[batch.organization_id,batch.id]);
  const entityCounts:Record<string,number>={};for(const record of applied)entityCounts[record.entity_kind]=(entityCounts[record.entity_kind]??0)+1;
  return{batchId:batch.id,status,appliedRows:new Set(applied.map(record=>record.row_number)).size,entityCounts,completedAt:(occurredAt??batch.completed_at??batch.created_at).toISOString()};
}

async function audit(client:DatabaseClient,input:{organizationId:string;actorId:string;batchId:string;action:string;correlationId:string;values:Record<string,unknown>}){await client.query("INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,new_values) VALUES($1,$2,$3,$4,'import-batch',$5,'application',$6,$7::jsonb)",[generateEntityId("aud"),input.organizationId,input.actorId,input.action,input.batchId,input.correlationId,JSON.stringify(input.values)]);}
async function queryRows<Row>(client:DatabaseClient,query:string,values:readonly unknown[]):Promise<Row[]>{return((await client.query(query,values))as{rows:Row[]}).rows;}
function stringValue(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null;}
function numberValue(value:unknown){return typeof value==="number"&&Number.isInteger(value)?value:null;}
async function acquireLocks(client:DatabaseClient,keys:readonly string[]){for(const key of [...keys].sort())await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[key]);}
async function assertControlledTenant(client:DatabaseClient,organizationId:string){const rows=await queryRows<{data_class:string}>(client,"SELECT data_class FROM organizations WHERE id=$1",[organizationId]);if(!["demo","pilot"].includes(rows[0]?.data_class??""))throw new ImportBatchConflictError("Controlled import commit and reversal are restricted to demo or pilot tenants.");}

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
