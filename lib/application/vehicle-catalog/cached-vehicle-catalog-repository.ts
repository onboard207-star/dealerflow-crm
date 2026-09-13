import type { VehicleCatalogRepository, VehicleCatalogSearchQuery } from "./catalog-domain";

export class CachedVehicleCatalogRepository implements VehicleCatalogRepository {
  private readonly entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
  constructor(private readonly repository: VehicleCatalogRepository, private readonly ttlMs = 60_000, private readonly now = () => Date.now()) {}
  listMakes = () => this.cached("makes", () => this.repository.listMakes());
  listModels = (makeId:string) => this.cached(`models:${makeId}`, () => this.repository.listModels(makeId));
  listModelYears = (modelId:string) => this.cached(`years:${modelId}`, () => this.repository.listModelYears(modelId));
  listTrims = (modelYearId:string) => this.cached(`trims:${modelYearId}`, () => this.repository.listTrims(modelYearId));
  listConfigurations = (trimId:string) => this.cached(`configurations:${trimId}`, () => this.repository.listConfigurations(trimId));
  getConfiguration = (configurationId:string) => this.cached(`configuration:${configurationId}`, () => this.repository.getConfiguration(configurationId));
  searchConfigurations = (query:VehicleCatalogSearchQuery) => this.cached(`search:${stable(query)}`, () => this.repository.searchConfigurations(query));
  clear() { this.entries.clear(); }
  private cached<T>(key:string, load:()=>Promise<T>):Promise<T> { const current=this.entries.get(key);if(current&&current.expiresAt>this.now())return current.value as Promise<T>;const value=load().catch((error:unknown)=>{this.entries.delete(key);throw error;});this.entries.set(key,{expiresAt:this.now()+this.ttlMs,value});return value; }
}
function stable(query:VehicleCatalogSearchQuery){return JSON.stringify(Object.fromEntries(Object.entries(query).sort(([a],[b])=>a.localeCompare(b))));}
