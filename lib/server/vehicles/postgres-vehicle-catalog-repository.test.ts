import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PostgresVehicleCatalogRepository } from "./postgres-vehicle-catalog-repository";

describe("PostgresVehicleCatalogRepository competitors",()=>{
  it("returns typed governed relationships without raw row shapes",async()=>{
    const query=vi.fn(async()=>({rows:[{id:"vcp_123",stable_key:"COMPARISON-CRV-RAV4",categories:["Compact SUV"],relationship_status:"active",readiness:"pilot-ready",evidence:{notes:"Same segment"},release_id:"vcr_release",source_system:"airtable",source_record_id:"recProvenance",subject_id:"vmo_crv",subject_stable_key:"MODEL-HONDA-CRV",subject_make_id:"vma_honda",subject_name:"CR-V",subject_make:"Honda",competitor_id:"vmo_rav4",competitor_stable_key:"MODEL-TOYOTA-RAV4",competitor_make_id:"vma_toyota",competitor_name:"RAV4",competitor_make:"Toyota"}]}));
    const repository=new PostgresVehicleCatalogRepository({query} as unknown as Pool);const result=await repository.listCompetitors("vmo_crv");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("comparison.subject_model_id=$1"),["vmo_crv"]);expect(result[0]).toMatchObject({stableKey:"COMPARISON-CRV-RAV4",subjectModel:{make:"Honda",model:"CR-V"},competitorModel:{make:"Toyota",model:"RAV4"},categories:["Compact SUV"],readiness:"pilot-ready"});expect(result[0]).not.toHaveProperty("subject_model_id");
  });
});
