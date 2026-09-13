import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { VehicleCatalogProjectionService, type VehicleCatalogManifest } from "@/lib/application/vehicle-catalog";
import { PostgresVehicleCatalogProjectionProvider } from "./postgres-vehicle-catalog-projector";

const manifest:VehicleCatalogManifest={sourceSystem:"airtable",sourceDataset:"catalog",sourceRevision:"r2",nodes:[
  {stableKey:"OEM-HONDA",name:"Honda",sourceSystem:"airtable",content:{}},
  {stableKey:"OEM-TOYOTA",name:"Toyota",sourceSystem:"airtable",content:{}},
  {stableKey:"MODEL-HONDA-CRV",name:"CR-V",parentStableKey:"OEM-HONDA",sourceSystem:"airtable",content:{}},
  {stableKey:"MODEL-TOYOTA-RAV4",name:"RAV4",parentStableKey:"OEM-TOYOTA",sourceSystem:"airtable",content:{}},
  {stableKey:"COMPARISON-CRV-RAV4",name:"CR-V vs RAV4",readiness:"pilot-ready",sourceSystem:"airtable",content:{subjectModelStableKey:"MODEL-HONDA-CRV",competitorModelStableKey:"MODEL-TOYOTA-RAV4",categories:["Compact SUV"],relationshipStatus:"Active"}},
]};

describe("Postgres vehicle catalog comparison projection",()=>{
  it("rolls back the entire release if a comparison cannot be projected",async()=>{
    const query=vi.fn(async(sql:string)=>{if(sql.includes("INSERT INTO vehicle_catalog_model_comparisons"))throw new Error("comparison rejected");if(sql.includes("RETURNING id"))return{rows:[{id:"accepted"}]};return{rows:[]};});
    const release=vi.fn();const pool={connect:async()=>({query,release})} as unknown as Pool;
    await expect(new VehicleCatalogProjectionService(new PostgresVehicleCatalogProjectionProvider(pool)).project(manifest)).rejects.toThrow("comparison rejected");
    expect(query).toHaveBeenCalledWith("ROLLBACK");expect(query).not.toHaveBeenCalledWith("COMMIT");expect(release).toHaveBeenCalledOnce();
  });
});
