import type { ManagementReport } from "./management-report";
export type ManagementMetricKey=keyof ManagementReport["metrics"];
export interface KpiDefinition{key:ManagementMetricKey;label:string;definition:string;format:"count"|"currency"}
export const managementKpiRegistry:readonly KpiDefinition[]=[
  {key:"newLeads",label:"New Leads",definition:"Leads created within the selected reporting window.",format:"count"},
  {key:"deliveredDeals",label:"Delivered Deals",definition:"Distinct Deals with a delivered status event within the selected window.",format:"count"},
  {key:"deliveredRevenueCents",label:"Delivered revenue",definition:"Agreed vehicle prices for Deals delivered in the window; not an accounting ledger.",format:"currency"},
  {key:"appointmentsCompleted",label:"Completed appointments",definition:"Appointments completed within the selected reporting window.",format:"count"},
  {key:"appointmentsNoShow",label:"No-show appointments",definition:"Appointments recorded as no-show within the selected reporting window.",format:"count"},
  {key:"overdueTasks",label:"Overdue tasks",definition:"Current open or in-progress tasks whose due time has passed.",format:"count"},
] as const;
export function formatKpiValue(definition:KpiDefinition,value:number){return definition.format==="currency"?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value/100):new Intl.NumberFormat("en-US").format(value)}
