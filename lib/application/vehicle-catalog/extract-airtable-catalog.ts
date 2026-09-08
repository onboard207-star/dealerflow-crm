import type { VehicleCatalogLink, VehicleCatalogManifest, VehicleCatalogNode, VehicleCatalogReadiness } from "./vehicle-catalog";

export interface AirtableCatalogRecord { id:string; fields:Readonly<Record<string,unknown>>; }
export interface AirtableCatalogSnapshot { baseId:string; revision:string; tables:Readonly<Record<string,readonly AirtableCatalogRecord[]>>; }
type TableRule={stableKey:string;name:string;parent?:string;readiness?:string;content:readonly string[]};
const hierarchy:Readonly<Record<string,TableRule>>={
  "OEM / Makes":{stableKey:"OEM ID",name:"Name",content:["Status"]},
  Models:{stableKey:"Model ID",name:"Model Name",parent:"OEM / Make",readiness:"Catalog Readiness",content:["Vehicle Class","Market Segment","Body Style","Status"]},
  "Model Years":{stableKey:"Model Year ID",name:"Model Year Key",parent:"Model",readiness:"Catalog Readiness",content:["Year","Generation","Lifecycle Status","Source Status"]},
  Trims:{stableKey:"Trim ID",name:"Trim Name",parent:"Model Year",readiness:"Catalog Readiness",content:["Series / Badge","MSRP Base","Status","Source Status"]},
  "Trim Configurations":{stableKey:"Configuration ID",name:"Configuration Key",parent:"Trim",readiness:"Catalog Readiness",content:["Drivetrain","Powertrain Type","Engine / Motor","Transmission","Body Style","Seating Capacity","Base MSRP","Status","Source Status"]},
};
type AttributeRule={kind:"exterior"|"interior"|"feature"|"package"|"specification";stableKey:readonly string[];name:readonly string[];readiness?:string;content:readonly string[];references?:Readonly<Record<string,string>>};
const attributes:Readonly<Record<string,AttributeRule>>={
  Features:{kind:"feature",stableKey:["Feature ID"],name:["Feature Name"],readiness:"Catalog Readiness",content:["Feature Category","Description","Availability Type","Source Status"]},
  "Packages & Options":{kind:"package",stableKey:["Package / Option ID"],name:["Package / Option Name"],readiness:"Catalog Readiness",content:["Type","Description","MSRP","Status","Source Status"],references:{"Included Features":"many"}},
  Specifications:{kind:"specification",stableKey:["Specification ID"],name:["Metric Name","Specification Key"],readiness:"Catalog Readiness",content:["Specification Category","Value","Unit","Source Status"]},
  "OEM Paint Colors":{kind:"exterior",stableKey:["Paint ID"],name:["Paint Name","Paint Key"],readiness:"Catalog Readiness",content:["OEM Paint Code","Premium Paint Default","Status","Source Status"],references:{"OEM / Make":"one"}},
  "OEM Interior Materials":{kind:"interior",stableKey:["Interior Material ID"],name:["Interior Name","Interior Material Key"],readiness:"Catalog Readiness",content:["Material / Upholstery","Status","Source Status"],references:{"OEM / Make":"one"}},
  "Exterior Paint Eligibility":{kind:"exterior",stableKey:["Exterior Color ID"],name:["Exterior Color Name"],readiness:"Catalog Readiness",content:["OEM Color Code","Premium Paint","Status","Source Status"],references:{"Model Year":"one","Canonical OEM Paint":"one"}},
  "Interior Eligibility":{kind:"interior",stableKey:["Interior Color ID"],name:["Interior Color Name"],readiness:"Catalog Readiness",content:["Material / Upholstery","Status","Source Status"],references:{"Model Year":"one","Canonical Interior Material":"one"}},
};

export class AirtableCatalogExtractionError extends Error{constructor(readonly issues:readonly string[]){super("Airtable vehicle catalog extraction failed.");this.name="AirtableCatalogExtractionError";}}

export function extractAirtableVehicleCatalog(snapshot:AirtableCatalogSnapshot):VehicleCatalogManifest{
  const issues:string[]=[],recordKeys=new Map<string,string>(),nodes:VehicleCatalogNode[]=[];
  for(const[table,rule]of Object.entries(hierarchy))for(const record of records(snapshot,table))register(record,table,rule.stableKey,undefined,recordKeys,issues);
  for(const[table,rule]of Object.entries(attributes))for(const record of records(snapshot,table))register(record,table,rule.stableKey,undefined,recordKeys,issues);
  const colorRules=records(snapshot,"Color Rules");
  for(const record of colorRules)register(record,"Color Rules",["Color Rule ID"],undefined,recordKeys,issues);

  for(const[table,rule]of Object.entries(hierarchy))for(const record of records(snapshot,table)){
    const stableKey=stringField(record,rule.stableKey);if(!stableKey)continue;
    const parentStableKey=rule.parent?resolveOne(record,rule.parent,recordKeys,`${table}/${record.id}`,issues):undefined;
    const links=table==="Trim Configurations"?configurationLinks(record,colorRules,recordKeys,issues):undefined;
    nodes.push({stableKey,name:stringField(record,rule.name)??stableKey,...(parentStableKey?{parentStableKey}:{}),...(rule.readiness?{readiness:readiness(record.fields[rule.readiness])}:{}),...(links?.length?{links}:{}),sourceSystem:"airtable",sourceRecordId:record.id,content:pickContent(record,rule.content)});
  }
  for(const[table,rule]of Object.entries(attributes))for(const record of records(snapshot,table)){
    const stableKey=firstString(record,rule.stableKey),name=firstString(record,rule.name);if(!stableKey||!name)continue;
    const references:Record<string,unknown>={};
    for(const[field,cardinality]of Object.entries(rule.references??{})){
      const resolved=resolveMany(record,field,recordKeys,`${table}/${record.id}`,issues);
      if(cardinality==="one"&&resolved.length!==1)issues.push(`${table}/${record.id}: ${field} must resolve to one governed record.`);
      references[field]=cardinality==="one"?resolved[0]:resolved;
    }
    nodes.push({stableKey,name,readiness:readiness(record.fields[rule.readiness??"Catalog Readiness"]),sourceSystem:"airtable",sourceRecordId:record.id,content:{kind:rule.kind,...pickContent(record,rule.content),...references}});
  }
  if(issues.length)throw new AirtableCatalogExtractionError(issues);
  return{sourceSystem:"airtable",sourceDataset:snapshot.baseId,sourceRevision:snapshot.revision,nodes};
}

function configurationLinks(configuration:AirtableCatalogRecord,colorRules:readonly AirtableCatalogRecord[],keys:ReadonlyMap<string,string>,issues:string[]):readonly VehicleCatalogLink[]{
  const links:VehicleCatalogLink[]=[];
  for(const[field,relationship]of [["⭐ Features","standard"],["📦 Packages & Options","optional"],["📐 Specifications","standard"]]as const){
    for(const id of linkedIds(configuration.fields[field])){const key=keys.get(id);if(key)links.push({targetStableKey:key,relationship,sourceRecordId:id});else issues.push(`Trim Configurations/${configuration.id}: ${field} contains an unresolved record.`);}
  }
  const byTarget=new Map<string,{targetStableKey:string;relationship:"available"|"excluded";rules:Array<Record<string,unknown>>}>();
  for(const ruleId of linkedIds(configuration.fields["🎨 Color Rules"])){
    const rule=colorRules.find(value=>value.id===ruleId);if(!rule){issues.push(`Trim Configurations/${configuration.id}: Color Rules contains an unresolved record.`);continue;}
    const ruleKey=keys.get(rule.id);if(!ruleKey)continue;
    const exterior=resolveMany(rule,"Exterior Color",keys,`Color Rules/${rule.id}`,issues),interior=resolveMany(rule,"Interior Color",keys,`Color Rules/${rule.id}`,issues);
    if(exterior.length!==1||interior.length<1){issues.push(`Color Rules/${rule.id}: one exterior and at least one interior are required.`);continue;}
    const availability=fieldText(rule.fields.Availability)?.toLowerCase()==="excluded"?"excluded":"available";
    for(const target of [...exterior,...interior]){
      const entry=byTarget.get(target)??{targetStableKey:target,relationship:availability,rules:[]};
      if(entry.relationship!==availability){issues.push(`Color Rules/${rule.id}: contradictory availability for ${target}.`);continue;}
      entry.rules.push({ruleStableKey:ruleKey,availability,exteriorStableKey:exterior[0],interiorStableKeys:interior,sourceRecordId:rule.id});byTarget.set(target,entry);
    }
  }
  for(const entry of byTarget.values())links.push({targetStableKey:entry.targetStableKey,relationship:entry.relationship,conditions:{colorRules:entry.rules}});
  return links;
}
function register(record:AirtableCatalogRecord,table:string,fields:string|readonly string[],prefix:string|undefined,keys:Map<string,string>,issues:string[]){const key=typeof fields==="string"?stringField(record,fields):firstString(record,fields);if(!key){issues.push(`${table}/${record.id}: stable ID is required.`);return;}keys.set(record.id,prefix&&!key.toUpperCase().startsWith(`${prefix}-`)?`${prefix}-${key}`:key);}
function resolveOne(record:AirtableCatalogRecord,field:string,keys:ReadonlyMap<string,string>,label:string,issues:string[]){const values=resolveMany(record,field,keys,label,issues);if(values.length!==1)issues.push(`${label}: ${field} must resolve to one governed parent.`);return values[0];}
function resolveMany(record:AirtableCatalogRecord,field:string,keys:ReadonlyMap<string,string>,label:string,issues:string[]){const result:string[]=[];for(const id of linkedIds(record.fields[field])){const key=keys.get(id);if(key)result.push(key);else issues.push(`${label}: ${field} contains an unresolved record.`);}return result;}
function pickContent(record:AirtableCatalogRecord,fields:readonly string[]){return Object.fromEntries(fields.filter(field=>record.fields[field]!==undefined).map(field=>[field,plainValue(record.fields[field])]));}
function plainValue(value:unknown):unknown{if(Array.isArray(value))return value.map(plainValue);if(value&&typeof value==="object"){if("name"in value&&typeof value.name==="string")return value.name;return Object.fromEntries(Object.entries(value).filter(([key])=>key!=="id").map(([key,item])=>[key,plainValue(item)]));}return value;}
function linkedIds(value:unknown){if(!Array.isArray(value))return[];return value.flatMap(item=>typeof item==="string"?[item]:item&&typeof item==="object"&&"id"in item&&typeof item.id==="string"?[item.id]:[]);}
function records(snapshot:AirtableCatalogSnapshot,name:string){return Object.entries(snapshot.tables).find(([table])=>table.replace(/^[^A-Za-z0-9]+\s*/,"")===name)?.[1]??[];}
function fieldText(value:unknown){if(typeof value==="string")return value.trim()||undefined;if(value&&typeof value==="object"&&"name"in value&&typeof value.name==="string")return value.name.trim()||undefined;return undefined;}
function stringField(record:AirtableCatalogRecord,field:string){return fieldText(record.fields[field]);}
function firstString(record:AirtableCatalogRecord,fields:readonly string[]){for(const field of fields){const value=stringField(record,field);if(value)return value;}return undefined;}
function readiness(value:unknown):VehicleCatalogReadiness{const normalized=(fieldText(value)??"needs-review").toLowerCase().replaceAll(" ","-");return ["needs-review","in-progress","verified","pilot-ready","not-applicable"].includes(normalized)?normalized as VehicleCatalogReadiness:"needs-review";}
