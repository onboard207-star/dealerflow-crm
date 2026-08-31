import { describe, expect, it, vi } from "vitest";
import type { ImportBatch } from "@/lib/application/launch";
import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { PostgresImportBatchProvider } from "./postgres-import-batches";

function database() { const query=vi.fn<DatabaseClient["query"]>().mockImplementation(async sql=>String(sql).includes("INSERT INTO import_batches")?{rows:[{id:batch.id}]}:{rows:[]}); const client:DatabaseClient={query,release:vi.fn()}; return {pool:{connect:vi.fn().mockResolvedValue(client)} as DatabasePool,query}; }
const batch:ImportBatch={id:"imb_batch001",organizationId:"org_dealer001",domain:"customer-lead",sourceName:"customers.csv",sourceChecksum:"a".repeat(64),mapping:{Name:"displayName"},status:"ready",idempotencyKey:"import-1",createdBy:"usr_admin001",createdAt:"2026-08-31T12:00:00.000Z",preview:{domain:"customer-lead",totalRows:1,validRows:1,rejectedRows:0,duplicateRows:0,unresolvedRows:0,rows:[{rowNumber:1,status:"valid",canonical:{displayName:"Jordan Lee"},issues:[]}]}};

describe("PostgresImportBatchProvider",()=>{
  it("writes batch, immutable canonical rows, and audit evidence in one tenant transaction",async()=>{const db=database();await new PostgresImportBatchProvider(db.pool,{userId:batch.createdBy,organizationId:batch.organizationId}).create(batch);expect(db.query.mock.calls[1]?.[1]).toEqual([batch.createdBy,batch.organizationId]);expect(db.query.mock.calls.some(([sql])=>String(sql).includes("ON CONFLICT(organization_id,idempotency_key) DO NOTHING"))).toBe(true);expect(db.query.mock.calls.some(([sql])=>String(sql).includes("INSERT INTO import_batch_rows"))).toBe(true);expect(db.query.mock.calls.some(([sql])=>String(sql).includes("import.batch_staged"))).toBe(true);});
  it("rejects a cross-tenant provider call before querying",()=>{const db=database();expect(()=>new PostgresImportBatchProvider(db.pool,{userId:batch.createdBy,organizationId:batch.organizationId}).findByIdempotencyKey("org_other001","same")).toThrow("tenant mismatch");expect(db.pool.connect).not.toHaveBeenCalled();});
});
