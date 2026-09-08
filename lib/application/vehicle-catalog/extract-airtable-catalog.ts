import type { VehicleCatalogManifest, VehicleCatalogNode, VehicleCatalogReadiness } from "./vehicle-catalog";

export interface AirtableCatalogRecord { id:string; fields:Readonly<Record<string,unknown>>; }
export interface AirtableCatalogSnapshot { baseId:string; revision:string; tables:Readonly<Record<string,readonly AirtableCatalogRecord[]>>; }
type TableRule={stableKey:string;name:string;parent?:string;readiness?:string;content:readonly string[]};
const hierarchy:Readonly<Record<string,TableRule>>={
  "OEM / Makes":{stableKey:"OEM ID",name:"Name",content:["Status"]},
  Models:{stableKey:"Model ID",name:"Model Name",parent:"OEM / Make",readiness:"Catalog Readiness",content:["Vehicle Class","Status"]},
  "Model Years":{stableKey:"Model Year ID",name:"Model Year Key",parent:"Model",readiness:"Catalog Readiness",content:["Year","Generation","Lifecycle Status","Source Status"]},
  Trims:{stableKey:"Trim ID",name:"Trim Name",parent:"Model Year",readiness:"Catalog Readiness",content:["Series / Badge","Status","Source Status"]},
  "Trim Configurations":{stableKey:"Configuration ID",name:"Configuration Key",parent:"Trim",readiness:"Catalog Readiness",content:["Drivetrain","Powertrain Type","Engine / Motor","Transmission","Body Style","Seating Capacity","Source Status"]},
};
const attributes:Readonly<Record<string,{kind:string;stableKey:readonly string[];name:readonly string[]}>>={
  Features:{kind:"FEATURE",stableKey:["Feature ID","ID"],name:["Feature Name","Name"]},
  "Packages & Options":{kind:"PACKAGE",stableKey:["Package / Option ID"],name:["Package / Option Name"]},
  Specifications:{kind:"SPEC",stableKey:["Specification ID"],name:["Metric Name","Specification Key"]},
  "OEM Paint Colors":{kind:"EXTERIOR",stableKey:["Paint ID","Color ID","ID"],name:["Paint Name","Color Name","Name"]},
  "OEM Interior Materials":{kind:"INTERIOR",stableKey:["Interior ID","Color ID","ID"],name:["Interior Name","Color Name","Name"]},
};

export class AirtableCatalogExtractionError extends Error{constructor(readonly issues:readonly string[]){super("Airtable vehicle catalog extraction failed.");this.name="AirtableCatalogExtractionError";}}

export function extractAirtableVehicleCatalog(snapshot:AirtableCatalogSnapshot):VehicleCatalogManifest{
  const issues:string[]=[],recordKeys=new Map<string,string>(),nodes:VehicleCatalogNode[]=[];
  for(const[table,rule]of Object.entries(hierarchy))for(const record of records(snapshot,table)){const key=stringField(record,rule.stableKey);if(!key){issues.push(`${table}/${record.id}: ${rule.stableKey} is required.`);continue;}recordKeys.set(record.id,key);}
  for(const[table,rule]of Object.entries(attributes))for(const record of records(snapshot,table)){const sourceKey=firstString(record,rule.stableKey);if(sourceKey)recordKeys.set(record.id,sourceKey.toUpperCase().startsWith(`${rule.kind}-`)?sourceKey:`${rule.kind}-${sourceKey}`);}
  for(const[table,rule]of Object.entries(hierarchy))for(const record of records(snapshot,table)){const stableKey=stringField(record,rule.stableKey);if(!stableKey)continue;const parentIds=rule.parent?linkedIds(record.fields[rule.parent]):[];const parentStableKey=parentIds[0]?recordKeys.get(parentIds[0]):undefined;if(rule.parent&&(parentIds.length!==1||!parentStableKey))issues.push(`${table}/${record.id}: ${rule.parent} must resolve to one governed parent.`);const links=table==="Trim Configurations"?configurationLinks(record,recordKeys,issues):undefined;nodes.push({stableKey,name:stringField(record,rule.name)??stableKey,...(parentStableKey?{parentStableKey}:{}),...(rule.readiness?{readiness:readiness(record.fields[rule.readiness])}:{}),...(links?.length?{links}:{}),sourceSystem:"airtable",sourceRecordId:record.id,content:Object.fromEntries(rule.content.filter(field=>record.fields[field]!==undefined).map(field=>[field,record.fields[field]]))});}
  for(const[table,rule]of Object.entries(attributes))for(const record of records(snapshot,table)){const sourceKey=firstString(record,rule.stableKey);const name=firstString(record,rule.name);if(!sourceKey||!name){issues.push(`${table}/${record.id}: stable ID and name are required.`);continue;}const stableKey=recordKeys.get(record.id)!;nodes.push({stableKey,name,sourceSystem:"airtable",sourceRecordId:record.id,content:{kind:rule.kind.toLowerCase(),...record.fields}});}
  if(issues.length)throw new AirtableCatalogExtractionError(issues);
  return{sourceSystem:"airtable",sourceDataset:snapshot.baseId,sourceRevision:snapshot.revision,nodes};
}
function linkedIds(value:unknown){if(!Array.isArray(value))return[];return value.flatMap(item=>typeof item==="string"?[item]:item&&typeof item==="object"&&"id"in item&&typeof item.id==="string"?[item.id]:[]);}
function records(snapshot:AirtableCatalogSnapshot,name:string){return Object.entries(snapshot.tables).find(([table])=>table.replace(/^[^A-Za-z0-9]+\s*/,"")===name)?.[1]??[];}
function configurationLinks(record:AirtableCatalogRecord,keys:ReadonlyMap<string,string>,issues:string[]){const result:Array<{targetStableKey:string;relationship:"standard"|"optional"|"available";sourceRecordId:string}>=[];for(const[field,relationship]of [["⭐ Features","standard"],["📦 Packages & Options","optional"],["📐 Specifications","standard"]]as const)for(const id of linkedIds(record.fields[field])){const key=keys.get(id);if(key)result.push({targetStableKey:key,relationship,sourceRecordId:id});else issues.push(`Trim Configurations/${record.id}: ${field} contains an unresolved record.`);}return result;}
function fieldText(value:unknown){if(typeof value==="string")return value.trim()||undefined;if(value&&typeof value==="object"&&"name"in value&&typeof value.name==="string")return value.name.trim()||undefined;return undefined;}
function stringField(record:AirtableCatalogRecord,field:string){return fieldText(record.fields[field]);}
function firstString(record:AirtableCatalogRecord,fields:readonly string[]){for(const field of fields){const value=stringField(record,field);if(value)return value;}return undefined;}
function readiness(value:unknown):VehicleCatalogReadiness{const normalized=(fieldText(value)??"needs-review").toLowerCase().replaceAll(" ","-");return ["needs-review","in-progress","verified","pilot-ready","not-applicable"].includes(normalized)?normalized as VehicleCatalogReadiness:"needs-review";}
