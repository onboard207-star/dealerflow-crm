import { describe, expect, it } from "vitest";
import { buildAIVehicleContext } from "./build-ai-vehicle-context";
import type { CatalogConfiguration, CatalogMake, CatalogModel, CatalogModelYear, CatalogTrim, VehicleCatalogRepository, VehicleCatalogSearchQuery } from "./catalog-domain";
import { VehicleConfigurationComparisonService } from "./compare-configurations";
import { CachedVehicleCatalogRepository } from "./cached-vehicle-catalog-repository";

const source = {sourceSystem:"airtable",sourceRecordId:"source-reference",releaseId:"vcr_test",readiness:"pilot-ready"} as const;
const makes:CatalogMake[]=[identity("vma_honda","OEM-HONDA","Honda"),identity("vma_toyota","OEM-TOYOTA","Toyota")];
const models:CatalogModel[]=[{...identity("vmo_crv","MODEL-HONDA-CRV","CR-V"),makeId:"vma_honda"},{...identity("vmo_rav4","MODEL-TOYOTA-RAV4","RAV4"),makeId:"vma_toyota"}];
const years:CatalogModelYear[]=[{...identity("vmy_crv","MY-HONDA-CRV-2026","2026"),modelId:"vmo_crv",year:2026},{...identity("vmy_rav4","MY-TOYOTA-RAV4-2026","2026"),modelId:"vmo_rav4",year:2026}];
const trims:CatalogTrim[]=[{...identity("vtr_crv","TRIM-HONDA-CRV-SPORTL","Sport-L Hybrid"),modelYearId:"vmy_crv"},{...identity("vtr_rav4","TRIM-TOYOTA-RAV4-XLE","XLE"),modelYearId:"vmy_rav4"}];
const configurations:CatalogConfiguration[]=[configuration("vcf_crv",0,"AWD","204","Honda Sensing"),configuration("vcf_rav4",1,"AWD",undefined,"Toyota Safety Sense")];

class FixtureRepository implements VehicleCatalogRepository{
  listMakes=async()=>makes;listModels=async(id:string)=>models.filter(item=>item.makeId===id);listModelYears=async(id:string)=>years.filter(item=>item.modelId===id);listTrims=async(id:string)=>trims.filter(item=>item.modelYearId===id);listConfigurations=async(id:string)=>configurations.filter(item=>item.trimId===id);getConfiguration=async(id:string)=>configurations.find(item=>item.id===id);
  searchConfigurations=async(query:VehicleCatalogSearchQuery)=>configurations.filter(item=>(!query.make||item.make.name.includes(query.make))&&(!query.model||item.model.name.includes(query.model))&&(!query.year||item.modelYear.year===query.year)&&(!query.trim||item.trim.name.includes(query.trim))&&(!query.configuration||item.name.includes(query.configuration)));
}

describe("vehicle catalog domain services",()=>{
  const repository=new FixtureRepository();
  it("preserves the OEM to configuration hierarchy and rejects invalid combinations",async()=>{
    expect(await repository.listModels("vma_honda")).toHaveLength(1);
    expect(await repository.listModelYears("vmo_crv")).toHaveLength(1);
    expect(await repository.listTrims("vmy_crv")).toHaveLength(1);
    expect(await repository.listConfigurations("vtr_rav4")).toHaveLength(1);
    expect(await repository.listConfigurations("vtr_crv")).not.toContainEqual(expect.objectContaining({model:{name:"RAV4"}}));
  });
  it("searches exact configuration dimensions without inventory facts",async()=>{
    const result=await repository.searchConfigurations({make:"Honda",model:"CR-V",year:2026,trim:"Sport-L"});
    expect(result).toHaveLength(1);expect(result[0]).not.toHaveProperty("vin");expect(result[0]).not.toHaveProperty("stockNumber");
  });
  it("compares shared facts and marks missing facts unavailable rather than zero",async()=>{
    const result=await new VehicleConfigurationComparisonService(repository).compare(["vcf_crv","vcf_rav4"]);
    const horsepower=result.facts.find(item=>item.key==="horsepower");
    expect(horsepower?.values).toEqual([expect.objectContaining({value:"Horsepower: 204 hp",state:"verified"}),expect.objectContaining({state:"unavailable"})]);
  });
  it("builds normalized AI context without raw source payloads",()=>{
    const context=buildAIVehicleContext(configurations[0]);
    expect(context.identity).toMatchObject({make:"Honda",model:"CR-V",year:2026,trim:"Sport-L Hybrid"});
    expect(context.features).toEqual(["Honda Sensing"]);expect(context).not.toHaveProperty("sourceRecordId");
  });
  it("requires two or three distinct configurations",async()=>{
    await expect(new VehicleConfigurationComparisonService(repository).compare(["vcf_crv"])).rejects.toThrow("two or three");
  });
  it("deduplicates concurrent catalog lookups and expires cached results",async()=>{
    let calls=0,now=0;const backing=new FixtureRepository();const original=backing.listMakes;backing.listMakes=async()=>{calls++;return original();};
    const cached=new CachedVehicleCatalogRepository(backing,10,()=>now);
    await Promise.all([cached.listMakes(),cached.listMakes()]);expect(calls).toBe(1);
    now=11;await cached.listMakes();expect(calls).toBe(2);
  });
});

function identity(id:string,stableKey:string,name:string){return{id,stableKey,name,...source};}
function configuration(id:string,index:number,drivetrain:string,horsepower:string|undefined,feature:string):CatalogConfiguration{const make=makes[index],model=models[index],modelYear=years[index],trim=trims[index];return{...identity(id,`CFG-${make.name}-${model.name}-2026`,`2026 ${make.name} ${model.name} ${trim.name} ${drivetrain}`),trimId:trim.id,make,model,modelYear,trim,drivetrain,attributes:[{...identity(`vca_hp_${index}`,`SPEC-HP-${index}`,"Horsepower"),kind:"specification",...(horsepower?{value:horsepower}:{}),unit:"hp",metadata:{},relationship:"standard",conditions:{}},{...identity(`vca_feature_${index}`,`FEATURE-${index}`,feature),kind:"feature",metadata:{},relationship:"standard",conditions:{}}]};}
