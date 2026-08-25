import { createHmac } from "node:crypto";
import { sanitizeTelemetryEvent, type TelemetryEvent } from "./telemetry";

export interface AlertWebhookConfiguration { url:string; secret:string; fetch?:typeof fetch; now?:()=>Date }
export class AlertDeliveryError extends Error { constructor(){super("Operational alert delivery failed.");this.name="AlertDeliveryError";} }
export class SignedAlertWebhook {
  private readonly request:typeof fetch; private readonly now:()=>Date;
  constructor(private readonly configuration:AlertWebhookConfiguration){this.request=configuration.fetch??fetch;this.now=configuration.now??(()=>new Date());}
  async deliver(event:TelemetryEvent):Promise<void>{
    const safe=sanitizeTelemetryEvent(event);
    const payload=JSON.stringify({version:1,timestamp:this.now().toISOString(),event:{code:safe.code,severity:safe.severity,correlationId:safe.correlationId,...(safe.organizationId?{organizationId:safe.organizationId}:{}),attributes:safe.attributes??{}}});
    const signature=createHmac("sha256",this.configuration.secret).update(payload).digest("hex");
    let response:Response;
    try{response=await this.request(this.configuration.url,{method:"POST",headers:{"content-type":"application/json","user-agent":"DealerFlow-AI/1.0","x-dealerflow-signature":`sha256=${signature}`},body:payload,signal:AbortSignal.timeout(5000)});}catch{throw new AlertDeliveryError();}
    if(!response.ok)throw new AlertDeliveryError();
  }
}
