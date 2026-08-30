import{assertAuthorized,type AuthorizationActor}from"@/lib/platform/auth";

export const implementationPhases=["discovery","configuration","data-preparation","integration-setup","user-provisioning","training","acceptance-testing","ready-for-launch","launch","hypercare","pilot-review","complete"]as const;
export type ImplementationPhase=typeof implementationPhases[number];
export const implementationStatuses=["not-started","in-progress","blocked","verified"]as const;
export type ImplementationStatus=typeof implementationStatuses[number];
export const launchGateKeys=["security","tenant-isolation","authorization","backup","restore","monitoring","provider-behavior","core-workflow","mobile","pilot-data","training","acceptance","support"]as const;
export type LaunchGateKey=typeof launchGateKeys[number];
export interface LaunchGate{key:LaunchGateKey;status:ImplementationStatus;evidence?:string}
export interface ImplementationProject{organizationId:string;name:string;launchType:"pilot"|"full";currentPhase:ImplementationPhase;phases:Readonly<Record<ImplementationPhase,ImplementationStatus>>;gates:readonly LaunchGate[];openDefects:readonly{severity:"p0"|"p1"|"p2"|"p3";summary:string}[];acceptanceDecision:"pending"|"go"|"no-go"}
export interface LaunchReadiness{percentage:number;ready:boolean;blockers:readonly string[]}

export function evaluateLaunchReadiness(project:ImplementationProject):LaunchReadiness{
  const blockers:string[]=[];
  const gateMap=new Map(project.gates.map(gate=>[gate.key,gate]));
  for(const key of launchGateKeys){const gate=gateMap.get(key);if(gate?.status!=="verified")blockers.push(`${label(key)} is ${gate?.status??"not recorded"}.`)}
  for(const defect of project.openDefects)if(defect.severity==="p0"||defect.severity==="p1")blockers.push(`${defect.severity.toUpperCase()}: ${defect.summary}`);
  if(project.acceptanceDecision!=="go")blockers.push(`Dealership acceptance decision is ${project.acceptanceDecision}.`);
  const verified=launchGateKeys.filter(key=>gateMap.get(key)?.status==="verified").length;
  return{percentage:Math.round(verified/launchGateKeys.length*100),ready:blockers.length===0,blockers};
}
export function evaluateAuthorizedLaunchReadiness(actor:AuthorizationActor,project:ImplementationProject):LaunchReadiness{assertAuthorized(actor,{organizationId:project.organizationId,capability:"organization.configure"});return evaluateLaunchReadiness(project)}
function label(value:string){return value.replaceAll("-"," ").replace(/^./,character=>character.toUpperCase())}
