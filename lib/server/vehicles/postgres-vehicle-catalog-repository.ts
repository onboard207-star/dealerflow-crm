import type { Pool } from "pg";
import type {
  CatalogAttribute, CatalogConfiguration, CatalogMake, CatalogModel, CatalogModelYear, CatalogTrim,
  VehicleCatalogRepository, VehicleCatalogSearchQuery,
} from "@/lib/application/vehicle-catalog";

const eligibleReadiness = ["verified", "pilot-ready"] as const;

export class PostgresVehicleCatalogRepository implements VehicleCatalogRepository {
  constructor(private readonly pool: Pool) {}

  async listMakes(): Promise<readonly CatalogMake[]> {
    const result = await this.pool.query<MakeRow>(`SELECT id,stable_key,name,release_id,source_system,source_record_id FROM vehicle_catalog_makes WHERE status='active' ORDER BY name,id`);
    return result.rows.map(make);
  }
  async listModels(makeId: string): Promise<readonly CatalogModel[]> {
    const result = await this.pool.query<ModelRow>(`SELECT id,make_id,stable_key,name,vehicle_class,release_id,source_system,source_record_id FROM vehicle_catalog_models WHERE status='active' AND make_id=$1 ORDER BY name,id`, [makeId]);
    return result.rows.map(model);
  }
  async listModelYears(modelId: string): Promise<readonly CatalogModelYear[]> {
    const result = await this.pool.query<ModelYearRow>(`SELECT id,model_id,stable_key,year,generation,readiness,release_id,source_system,source_record_id FROM vehicle_catalog_model_years WHERE model_id=$1 AND readiness<>'not-applicable' ORDER BY year DESC,id`, [modelId]);
    return result.rows.map(modelYear);
  }
  async listTrims(modelYearId: string): Promise<readonly CatalogTrim[]> {
    const result = await this.pool.query<TrimRow>(`SELECT id,model_year_id,stable_key,name,badge,readiness,release_id,source_system,source_record_id FROM vehicle_catalog_trims WHERE model_year_id=$1 AND readiness<>'not-applicable' ORDER BY name,id`, [modelYearId]);
    return result.rows.map(trim);
  }
  async listConfigurations(trimId: string): Promise<readonly CatalogConfiguration[]> {
    return this.queryConfigurations("configuration.trim_id=$1", [trimId], 250);
  }
  async getConfiguration(configurationId: string): Promise<CatalogConfiguration | undefined> {
    return (await this.queryConfigurations("configuration.id=$1", [configurationId], 1))[0];
  }
  async searchConfigurations(query: VehicleCatalogSearchQuery): Promise<readonly CatalogConfiguration[]> {
    const clauses: string[] = [], values: unknown[] = [];
    const add = (sql: string, value: unknown) => { values.push(value); clauses.push(sql.replace("?", `$${values.length}`)); };
    if (query.make) add("make.name ILIKE ?", `%${escapeLike(query.make)}%`);
    if (query.model) add("model.name ILIKE ?", `%${escapeLike(query.model)}%`);
    if (query.year !== undefined) add("model_year.year=?", query.year);
    if (query.trim) add("trim.name ILIKE ?", `%${escapeLike(query.trim)}%`);
    if (query.configuration) add("configuration.name ILIKE ?", `%${escapeLike(query.configuration)}%`);
    const readiness = query.readiness?.length ? query.readiness : eligibleReadiness;
    values.push(readiness);
    clauses.push(`configuration.readiness=ANY($${values.length}::text[])`);
    return this.queryConfigurations(clauses.join(" AND "), values, Math.min(Math.max(query.limit ?? 50, 1), 250));
  }

  private async queryConfigurations(where: string, values: readonly unknown[], limit: number) {
    const result = await this.pool.query<ConfigurationRow>(`${configurationSelect} WHERE ${where} ORDER BY make.name,model.name,model_year.year DESC,trim.name,configuration.name LIMIT ${limit}`, [...values]);
    const configurations = result.rows.map(configuration);
    if (!configurations.length) return configurations;
    const attributes = await this.pool.query<AttributeRow>(`${attributeSelect} WHERE relationship.configuration_id=ANY($1::text[]) ORDER BY attribute.kind,attribute.name,attribute.id`, [configurations.map((item) => item.id)]);
    const byConfiguration = Map.groupBy(attributes.rows, (row) => row.configuration_id);
    return configurations.map((item) => ({ ...item, attributes: (byConfiguration.get(item.id) ?? []).map(attribute) }));
  }
}

const configurationSelect = `SELECT configuration.id,configuration.trim_id,configuration.stable_key,configuration.name,
  configuration.drivetrain,configuration.powertrain,configuration.engine,configuration.transmission,configuration.body_style,configuration.seat_count,
  configuration.readiness,configuration.release_id,configuration.source_system,configuration.source_record_id,
  trim.model_year_id,trim.stable_key AS trim_stable_key,trim.name AS trim_name,trim.badge,trim.readiness AS trim_readiness,
  model_year.model_id,model_year.stable_key AS model_year_stable_key,model_year.year,model_year.generation,model_year.readiness AS model_year_readiness,
  model.make_id,model.stable_key AS model_stable_key,model.name AS model_name,model.vehicle_class,
  make.stable_key AS make_stable_key,make.name AS make_name
FROM vehicle_catalog_configurations configuration
JOIN vehicle_catalog_trims trim ON trim.id=configuration.trim_id
JOIN vehicle_catalog_model_years model_year ON model_year.id=trim.model_year_id
JOIN vehicle_catalog_models model ON model.id=model_year.model_id
JOIN vehicle_catalog_makes make ON make.id=model.make_id`;
const attributeSelect = `SELECT relationship.configuration_id,relationship.relationship,relationship.conditions,
  attribute.id,attribute.stable_key,attribute.kind,attribute.name,attribute.value,attribute.unit,attribute.metadata,
  attribute.release_id,attribute.source_system,attribute.source_record_id
FROM vehicle_catalog_configuration_attributes relationship JOIN vehicle_catalog_attributes attribute ON attribute.id=relationship.attribute_id`;

type Readiness = CatalogConfiguration["readiness"];
interface ProvenanceRow { id:string;stable_key:string;release_id:string;source_system:string;source_record_id:string|null }
interface MakeRow extends ProvenanceRow { name:string }
interface ModelRow extends ProvenanceRow { make_id:string;name:string;vehicle_class:string|null }
interface ModelYearRow extends ProvenanceRow { model_id:string;year:number;generation:string|null;readiness:Readiness }
interface TrimRow extends ProvenanceRow { model_year_id:string;name:string;badge:string|null;readiness:Readiness }
interface ConfigurationRow extends ProvenanceRow { trim_id:string;name:string;drivetrain:string|null;powertrain:string|null;engine:string|null;transmission:string|null;body_style:string|null;seat_count:number|null;readiness:Readiness;model_year_id:string;trim_stable_key:string;trim_name:string;badge:string|null;trim_readiness:Readiness;model_id:string;model_year_stable_key:string;year:number;generation:string|null;model_year_readiness:Readiness;make_id:string;model_stable_key:string;model_name:string;vehicle_class:string|null;make_stable_key:string;make_name:string }
interface AttributeRow extends ProvenanceRow { configuration_id:string;kind:CatalogAttribute["kind"];name:string;value:string|null;unit:string|null;metadata:Record<string,unknown>;relationship:CatalogAttribute["relationship"];conditions:Record<string,unknown> }
const source = (row: ProvenanceRow, readiness: Readiness) => ({ sourceSystem:row.source_system,...(row.source_record_id?{sourceRecordId:row.source_record_id}:{}),releaseId:row.release_id,readiness });
const make = (row: MakeRow): CatalogMake => ({id:row.id,stableKey:row.stable_key,name:row.name,...source(row,"verified")});
const model = (row: ModelRow): CatalogModel => ({id:row.id,makeId:row.make_id,stableKey:row.stable_key,name:row.name,...(row.vehicle_class?{vehicleClass:row.vehicle_class}:{}),...source(row,"verified")});
const modelYear = (row: ModelYearRow): CatalogModelYear => ({id:row.id,modelId:row.model_id,stableKey:row.stable_key,name:String(row.year),year:row.year,...(row.generation?{generation:row.generation}:{}),...source(row,row.readiness)});
const trim = (row: TrimRow): CatalogTrim => ({id:row.id,modelYearId:row.model_year_id,stableKey:row.stable_key,name:row.name,...(row.badge?{badge:row.badge}:{}),...source(row,row.readiness)});
function configuration(row: ConfigurationRow): CatalogConfiguration { return {id:row.id,trimId:row.trim_id,stableKey:row.stable_key,name:row.name,...source(row,row.readiness),make:{id:row.make_id,stableKey:row.make_stable_key,name:row.make_name,...source(row,"verified")},model:{id:row.model_id,makeId:row.make_id,stableKey:row.model_stable_key,name:row.model_name,...(row.vehicle_class?{vehicleClass:row.vehicle_class}:{}),...source(row,"verified")},modelYear:{id:row.model_year_id,modelId:row.model_id,stableKey:row.model_year_stable_key,name:String(row.year),year:row.year,...(row.generation?{generation:row.generation}:{}),...source(row,row.model_year_readiness)},trim:{id:row.trim_id,modelYearId:row.model_year_id,stableKey:row.trim_stable_key,name:row.trim_name,...(row.badge?{badge:row.badge}:{}),...source(row,row.trim_readiness)},...(row.drivetrain?{drivetrain:row.drivetrain}:{}),...(row.powertrain?{powertrain:row.powertrain}:{}),...(row.engine?{engine:row.engine}:{}),...(row.transmission?{transmission:row.transmission}:{}),...(row.body_style?{bodyStyle:row.body_style}:{}),...(row.seat_count!==null?{seatCount:row.seat_count}:{}),attributes:[]}; }
const attribute = (row: AttributeRow): CatalogAttribute => ({id:row.id,stableKey:row.stable_key,name:row.name,kind:row.kind,...(row.value?{value:row.value}:{}),...(row.unit?{unit:row.unit}:{}),metadata:row.metadata,relationship:row.relationship,conditions:row.conditions,...source(row,"verified")});
function escapeLike(value:string){return value.trim().replace(/[\\%_]/g,"\\$&");}
