import type { Capability } from "@/lib/platform/auth";
import type { DatabasePool } from "@/lib/server/database";
import { CRMDirectoryReader } from "@/lib/server/crm";
import { DealDirectoryReader } from "@/lib/server/deals";
import { InventoryDirectoryReader } from "@/lib/server/vehicles";

export type GlobalSearchKind="customer"|"lead"|"inventory"|"deal";
export interface GlobalSearchResult{kind:GlobalSearchKind;id:string;label:string;description:string;href:string}
interface SearchScope{userId:string;organizationId:string;locationIds:readonly string[]|"all";capabilities:readonly Capability[]}
interface Sources{
  customers(scope:SearchScope,query:string,limit:number):Promise<readonly {id:string;displayName:string;email?:string;phone?:string;status:string}[]>;
  leads(scope:SearchScope,query:string,limit:number):Promise<readonly {id:string;customerId:string;customerName:string;stage:string;status:string;source:string}[]>;
  inventory(scope:SearchScope,query:string,limit:number):Promise<readonly {inventoryId:string;stockNumber:string;vin:string;year:number;make:string;model:string;trim?:string;status:string}[]>;
  deals(scope:SearchScope,query:string,limit:number):Promise<readonly {id:string;customerId:string;customerName:string;dealNumber:string;vehicleLabel:string;status:string}[]>;
}
export class GlobalSearchQueryError extends Error{}
export class GlobalSearchReader{
  constructor(private readonly sources:Sources){}
  static postgres(pool:DatabasePool){const crm=new CRMDirectoryReader(pool);const inventory=new InventoryDirectoryReader(pool);const deals=new DealDirectoryReader(pool);return new GlobalSearchReader({customers:async(s,q,l)=>(await crm.listCustomers(s,{search:q,limit:l})).records,leads:async(s,q,l)=>(await crm.listLeads(s,{search:q,limit:l})).records,inventory:async(s,q,l)=>(await inventory.list(s,{search:q,limit:l})).records,deals:async(s,q,l)=>(await deals.list(s,{search:q,limit:l})).records});}
  async search(scope:SearchScope,query:string,limit=5):Promise<readonly GlobalSearchResult[]>{const q=query.trim();if(q.length<2)throw new GlobalSearchQueryError("Search requires at least two characters.");if(q.length>100)throw new GlobalSearchQueryError("Search cannot exceed 100 characters.");if(!Number.isInteger(limit)||limit<1||limit>10)throw new GlobalSearchQueryError("Limit must be between 1 and 10.");const has=(capability:Capability)=>scope.capabilities.includes(capability);const base=`/organizations/${scope.organizationId}`;const [customers,leads,inventory,deals]=await Promise.all([
      has("customer.read")?this.sources.customers(scope,q,limit):[],has("lead.read")?this.sources.leads(scope,q,limit):[],has("inventory.read")?this.sources.inventory(scope,q,limit):[],has("deal.read")?this.sources.deals(scope,q,limit):[],
    ]);return[
      ...customers.map(item=>({kind:"customer"as const,id:item.id,label:item.displayName,description:[item.status,item.email??item.phone].filter(Boolean).join(" · "),href:`${base}/customers/${item.id}`})),
      ...leads.map(item=>({kind:"lead"as const,id:item.id,label:item.customerName,description:`${item.stage} · ${item.status} · ${item.source}`,href:`${base}/customers/${item.customerId}`})),
      ...inventory.map(item=>({kind:"inventory"as const,id:item.inventoryId,label:`${item.year} ${item.make} ${item.model}${item.trim?` ${item.trim}`:""}`,description:`Stock ${item.stockNumber} · ${item.status} · ${item.vin}`,href:`${base}/inventory?q=${encodeURIComponent(item.stockNumber)}`})),
      ...deals.map(item=>({kind:"deal"as const,id:item.id,label:`${item.dealNumber} · ${item.customerName}`,description:`${item.vehicleLabel} · ${item.status}`,href:`${base}/customers/${item.customerId}`})),
    ];}
}
