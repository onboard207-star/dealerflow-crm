export type SystemHealthStatus="operational"|"degraded"|"down"|"not-configured";
export interface SystemHealthItem{id:string;label:string;status:SystemHealthStatus;detail:string}
export interface ProviderEvidence{smsConfigured:boolean;smsAccepted:number;smsFailures:number;emailConfigured:boolean;emailSent:number;emailFailures:number;aiConfigured:boolean;mediaConfigured:boolean;jobsConfigured:boolean}

export function resolveSystemHealth(evidence:ProviderEvidence):readonly SystemHealthItem[]{return[
  {id:"application",label:"Application",status:"operational",detail:"This authenticated Command Center request completed."},
  {id:"database",label:"Database",status:"operational",detail:"Tenant-scoped operational queries completed."},
  provider("ai","DealerFlow AI",evidence.aiConfigured,0,0,"No live provider probe or generation evidence is included here."),
  provider("sms","SMS",evidence.smsConfigured,evidence.smsAccepted,evidence.smsFailures,"Twilio delivery evidence in the last seven days."),
  provider("email","Email",evidence.emailConfigured,evidence.emailSent,evidence.emailFailures,"Transactional email outcomes in the last seven days."),
  {id:"slack",label:"Slack",status:"not-configured",detail:"No governed Slack provider is implemented."},
  provider("media","Media Storage",evidence.mediaConfigured,0,0,"Configuration exists, but this surface does not probe object storage."),
  provider("jobs","Background Jobs",evidence.jobsConfigured,0,0,"Scheduler configuration exists, but a durable heartbeat is not implemented."),
];}

function provider(id:string,label:string,configured:boolean,success:number,failures:number,qualification:string):SystemHealthItem{if(!configured)return{id,label,status:"not-configured",detail:`${label} is not configured for this deployment.`};if(failures>0)return{id,label,status:"degraded",detail:`${failures} failed or unresolved outcome${failures===1?"":"s"} in the last seven days. ${qualification}`};if(success>0)return{id,label,status:"operational",detail:`${success} confirmed successful outcome${success===1?"":"s"} in the last seven days. ${qualification}`};return{id,label,status:"degraded",detail:`Configured, but no recent confirmed success is available. ${qualification}`};}
