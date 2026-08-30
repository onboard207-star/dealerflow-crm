import type { ConnectorHealth, ConnectorResult, ExternalConnector, ExternalRecord, TenantIntegrationContext } from "./connector-platform";
export type StubScenario="success"|"authentication-failure"|"provider-down"|"rate-limit"|"malformed"|"duplicate";
export class DealerFlowStubConnector implements ExternalConnector {
  readonly providerId="dealerflow-stub";
  constructor(private readonly scenario:StubScenario,private readonly records:readonly ExternalRecord[]=[]){ }
  async verify():Promise<ConnectorHealth>{if(this.scenario==="authentication-failure")return health("failed","Stub authentication failure.","authentication");if(this.scenario==="provider-down")return health("degraded","Stub provider unavailable.","provider-down");return health("operational","Deterministic internal stub verified.")}
  healthCheck(){return this.verify()}
  async pull(){if(this.scenario==="rate-limit")throw new Error("stub-rate-limit");if(this.scenario==="malformed")return{records:[{objectType:"unknown",externalId:"malformed",observedAt:new Date(0).toISOString(),attributes:{invalid:true}}]};const records=this.scenario==="duplicate"&&this.records[0]?[this.records[0],this.records[0]]:this.records;return{records,nextCheckpoint:"stub-checkpoint-1"}}
  async handleWebhook(context:TenantIntegrationContext,payload:unknown):Promise<ConnectorResult>{void context;return payload&&typeof payload==="object"?{examined:1,created:1,updated:0,skipped:0,rejected:0,failed:0}:{examined:1,created:0,updated:0,skipped:0,rejected:1,failed:0}}
}
function health(status:ConnectorHealth["status"],evidence:string,errorCategory?:ConnectorHealth["errorCategory"]):ConnectorHealth{return{status,checkedAt:new Date(0).toISOString(),evidence,...(errorCategory?{errorCategory}:{})}}
