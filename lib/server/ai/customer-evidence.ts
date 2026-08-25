import type { RecommendationEvidence } from "@/lib/application/ai";
import type { CustomerWorkspaceRecord } from "@/lib/server/customers";

export function buildCustomerRecommendationEvidence(record:CustomerWorkspaceRecord):readonly RecommendationEvidence[]{
  const evidence:RecommendationEvidence[]=[];
  if(record.lead)evidence.push({id:`lead:${record.lead.id}`,category:"engagement",observation:`Active buying-cycle stage is ${record.lead.stage}; status is ${record.lead.status}.`,observedAt:record.lead.createdAt});
  if(record.nextAppointment)evidence.push({id:`appointment:${record.nextAppointment.id}`,category:"appointment",observation:`Next ${record.nextAppointment.type} appointment is ${record.nextAppointment.status} for ${record.nextAppointment.startsAt}.`,observedAt:record.nextAppointment.startsAt});
  if(record.currentVisit)evidence.push({id:`visit:${record.currentVisit.id}`,category:"engagement",observation:`Showroom visit is ${record.currentVisit.status}; purpose is ${record.currentVisit.purpose}.`,observedAt:record.currentVisit.startedAt??record.currentVisit.arrivedAt});
  for(const interest of record.vehicleInterests.slice(0,5))evidence.push({id:`vehicle:${interest.id}`,category:"vehicle",observation:`${interest.role} interest: ${interest.year} ${interest.make} ${interest.model}; interest ${interest.status}${interest.inventoryStatus?`; inventory ${interest.inventoryStatus}`:""}.`,observedAt:record.lead?.createdAt??record.customer.createdAt});
  if(record.deal)evidence.push({id:`deal:${record.deal.id}`,category:"deal",observation:`Deal status is ${record.deal.status}${record.deal.purchaseType?`; purchase type ${record.deal.purchaseType}`:""}.`,observedAt:record.timeline.find((item)=>item.kind==="deal")?.occurredAt??record.customer.createdAt});
  if(record.quote)evidence.push({id:`quote:${record.quote.id}`,category:"deal",observation:`Quote version ${record.quote.version} is ${record.quote.status} using ${record.quote.purchaseType}.`,observedAt:record.timeline.find((item)=>item.kind==="quote")?.occurredAt??record.customer.createdAt});
  for(const event of record.timeline.slice(0,12))evidence.push({id:`timeline:${event.id}`,category:mapCategory(event.kind),observation:`${event.title}${event.status?`; status ${event.status}`:""}.`,observedAt:event.occurredAt});
  return deduplicate(evidence).slice(0,30);
}
function mapCategory(kind:string):RecommendationEvidence["category"]{if(kind==="appointment")return"appointment";if(kind==="vehicle")return"vehicle";if(["deal","quote","trade","delivery"].includes(kind))return"deal";if(kind==="communication")return"communication";if(kind==="task")return"task";return"engagement";}
function deduplicate(evidence:readonly RecommendationEvidence[]){const ids=new Set<string>();return evidence.filter((item)=>{if(ids.has(item.id))return false;ids.add(item.id);return true;});}
