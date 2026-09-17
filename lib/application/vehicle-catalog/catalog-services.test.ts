import { describe, expect, it } from "vitest";
import { buildAIVehicleContext } from "./build-ai-vehicle-context";
import type { CatalogConfiguration, CatalogMake, CatalogModel, CatalogModelComparison, CatalogModelYear, CatalogTrim, VehicleCatalogRepository, VehicleCatalogSearchQuery } from "./catalog-domain";
import { VehicleConfigurationComparisonService } from "./compare-configurations";
import { CachedVehicleCatalogRepository } from "./cached-vehicle-catalog-repository";

const source = {sourceSystem:"airtable",sourceRecordId:"source-reference",releaseId:"vcr_test",readiness:"pilot-ready"} as const;
const makes:CatalogMake[]=[identity("vma_honda","OEM-HONDA","Honda"),identity("vma_toyota","OEM-TOYOTA","Toyota")];
const models:CatalogModel[]=[{...identity("vmo_crv","MODEL-HONDA-CRV","CR-V"),makeId:"vma_honda"},{...identity("vmo_rav4","MODEL-TOYOTA-RAV4","RAV4"),makeId:"vma_toyota"}];
const years:CatalogModelYear[]=[{...identity("vmy_crv","MY-HONDA-CRV-2026","2026"),modelId:"vmo_crv",year:2026},{...identity("vmy_rav4","MY-TOYOTA-RAV4-2026","2026"),modelId:"vmo_rav4",year:2026}];
const trims:CatalogTrim[]=[{...identity("vtr_crv","TRIM-HONDA-CRV-SPORTL","Sport-L Hybrid"),modelYearId:"vmy_crv"},{...identity("vtr_rav4","TRIM-TOYOTA-RAV4-XLE","XLE"),modelYearId:"vmy_rav4"}];
const configurations:CatalogConfiguration[]=[configuration("vcf_crv",0,"AWD","204","Honda Sensing"),configuration("vcf_rav4",1,"AWD",undefined,"Toyota Safety Sense")];
const comparisons:CatalogModelComparison[]=[{id:"vcp_crv_rav4",stableKey:"COMPARISON-CRV-RAV4",subjectModel:{id:"vmo_crv",stableKey:"MODEL-HONDA-CRV",makeId:"vma_honda",make:"Honda",model:"CR-V"},competitorModel:{id:"vmo_rav4",stableKey:"MODEL-TOYOTA-RAV4",makeId:"vma_toyota",make:"Toyota",model:"RAV4"},categories:["Compact SUV","Hybrid"],relationship:"active",evidence:{},...source}];

class FixtureRepository implements VehicleCatalogRepository{
  listMakes=async()=>makes;listModels=async(id:string)=>models.filter(item=>item.makeId===id);listModelYears=async(id:string)=>years.filter(item=>item.modelId===id);listTrims=async(id:string)=>trims.filter(item=>item.modelYearId===id);listConfigurations=async(id:string)=>configurations.filter(item=>item.trimId===id);getConfiguration=async(id:string)=>configurations.find(item=>item.id===id);
  searchConfigurations=async(query:VehicleCatalogSearchQuery)=>configurations.filter(item=>(!query.make||item.make.name.includes(query.make))&&(!query.model||item.model.name.includes(query.model))&&(!query.year||item.modelYear.year===query.year)&&(!query.trim||item.trim.name.includes(query.trim))&&(!query.configuration||item.name.includes(query.configuration)));
  listCompetitors=async(modelId:string)=>comparisons.filter(item=>item.subjectModel.id===modelId);
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
  it("separates electric range, charging, connector, MPG, and MPGe while preserving attribute readiness",async()=>{
    const electric={...configurations[0],powertrain:"Battery Electric",attributes:[
      specification("vca_range","SPEC-EPA-ALL-ELECTRIC-RANGE","EPA All-Electric Range","308","mi","pilot-ready",{"Specification Category":"Battery / Charging"}),
      specification("vca_charge","SPEC-DC-FAST-CHARGING","DC Fast Charging","20–80% in 35","min","verified",{"Specification Category":"Battery / Charging"}),
      specification("vca_connector","SPEC-CHARGING-CONNECTOR","Charging Connector","NACS",undefined,"verified",{"Specification Category":"Battery / Charging"}),
      specification("vca_mpge","SPEC-COMBINED-MPGE","Combined MPGe","99","MPGe","needs-review",{"Specification Category":"Fuel Economy"}),
    ]};
    const repository=new FixtureRepository();
    repository.getConfiguration=async(id:string)=>id==="vcf_ev"?electric:configurations[1];
    const result=await new VehicleConfigurationComparisonService(repository).compare(["vcf_ev","vcf_rav4"]);
    expect(result.facts.find(item=>item.key==="ev-range")?.values[0]).toMatchObject({value:"EPA All-Electric Range: 308 mi",state:"verified"});
    expect(result.facts.find(item=>item.key==="charging")?.values[0]).toMatchObject({value:"DC Fast Charging: 20–80% in 35 min",state:"verified"});
    expect(result.facts.find(item=>item.key==="connector")?.values[0]).toMatchObject({value:"Charging Connector: NACS",state:"verified"});
    expect(result.facts.find(item=>item.key==="mpge")?.values[0]).toMatchObject({value:"Combined MPGe: 99 MPGe",state:"incomplete"});
    expect(result.facts.find(item=>item.key==="mpg")?.values[0]).toMatchObject({state:"unavailable"});
  });
  it("builds normalized AI context without raw source payloads",()=>{
    const context=buildAIVehicleContext(configurations[0],comparisons);
    expect(context.identity).toMatchObject({make:"Honda",model:"CR-V",year:2026,trim:"Sport-L Hybrid"});
    expect(context.features).toEqual(["Honda Sensing"]);expect(context.competitors).toEqual([{modelId:"vmo_rav4",make:"Toyota",model:"RAV4",categories:["Compact SUV","Hybrid"],readiness:"pilot-ready"}]);expect(context).not.toHaveProperty("sourceRecordId");
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
function specification(id:string,stableKey:string,name:string,value:string,unit:string|undefined,readiness:CatalogConfiguration["readiness"],metadata:Record<string,unknown>){return{id,stableKey,name,sourceSystem:"airtable",sourceRecordId:"source-reference",releaseId:"vcr_test",readiness,kind:"specification" as const,value,...(unit?{unit}:{}),metadata,relationship:"standard" as const,conditions:{}};}
