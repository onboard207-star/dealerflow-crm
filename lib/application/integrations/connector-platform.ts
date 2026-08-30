export type ProviderCategory="dms"|"crm"|"inventory"|"website-lead"|"communications"|"marketing"|"service"|"finance"|"identity"|"analytics"|"other";
export type AuthenticationType="oauth2"|"api-key"|"basic"|"webhook-secret"|"none";
export type ConnectorOperation="verify"|"health-check"|"pull"|"push"|"sync"|"handle-webhook"|"disconnect";
export type IntegrationStatus="not-configured"|"configuring"|"verifying"|"operational"|"degraded"|"failed"|"disabled";
export type ConnectorReleaseStage="internal-development"|"staging-only"|"pilot"|"generally-available"|"disabled";
export type IntegrationErrorCategory="authentication"|"authorization"|"rate-limit"|"network"|"schema"|"mapping"|"provider-down"|"tenant-config"|"data-conflict"|"unknown";
export type ConnectorCapability="lead:read"|"lead:write"|"inventory:read"|"inventory:write"|"appointment:read"|"appointment:write"|"customer:read"|"customer:write"|"deal:read"|"deal:write"|"message:send"|"message:receive";

export interface ProviderDefinition {readonly id:string;readonly displayName:string;readonly category:ProviderCategory;readonly capabilities:readonly ConnectorCapability[];readonly authentication:AuthenticationType;readonly operations:readonly ConnectorOperation[];readonly releaseStage:ConnectorReleaseStage;readonly verification:"verified-staging"|"contract-only"|"stub";readonly documentationReference?:string}
export interface TenantIntegrationContext {readonly organizationId:string;readonly integrationId:string;readonly locationId?:string;readonly correlationId:string;readonly credentialReference?:string}
export interface ConnectorHealth {readonly status:Extract<IntegrationStatus,"operational"|"degraded"|"failed">;readonly checkedAt:string;readonly evidence:string;readonly errorCategory?:IntegrationErrorCategory}
export interface ConnectorResult {readonly examined:number;readonly created:number;readonly updated:number;readonly skipped:number;readonly rejected:number;readonly failed:number;readonly checkpoint?:string}
export interface ExternalRecord {readonly objectType:string;readonly externalId:string;readonly observedAt:string;readonly attributes:Readonly<Record<string,unknown>>}
export interface ConnectorCredentialResolver {resolve(reference:string,context:{organizationId:string;integrationId:string}):Promise<Readonly<Record<string,string>>>}

export interface ExternalConnector {
  readonly providerId:string;
  verify?(context:TenantIntegrationContext,credentials:Readonly<Record<string,string>>):Promise<ConnectorHealth>;
  healthCheck?(context:TenantIntegrationContext,credentials:Readonly<Record<string,string>>):Promise<ConnectorHealth>;
  pull?(context:TenantIntegrationContext,credentials:Readonly<Record<string,string>>,checkpoint?:string):Promise<{records:readonly ExternalRecord[];nextCheckpoint?:string}>;
  push?(context:TenantIntegrationContext,credentials:Readonly<Record<string,string>>,records:readonly ExternalRecord[]):Promise<ConnectorResult>;
  handleWebhook?(context:TenantIntegrationContext,payload:unknown):Promise<ConnectorResult>;
  disconnect?(context:TenantIntegrationContext,credentials:Readonly<Record<string,string>>):Promise<void>;
}

export class UnsupportedConnectorOperationError extends Error {constructor(readonly providerId:string,readonly operation:ConnectorOperation){super(`${providerId} does not support ${operation}.`);this.name="UnsupportedConnectorOperationError"}}
export class ConnectorPlatformError extends Error {constructor(readonly category:IntegrationErrorCategory,message:string,readonly retryable:boolean){super(message);this.name="ConnectorPlatformError"}}

const definitions:readonly ProviderDefinition[]=[
  {id:"twilio",displayName:"Twilio",category:"communications",capabilities:["message:send","message:receive"],authentication:"webhook-secret",operations:["verify","health-check","push","handle-webhook","disconnect"],releaseStage:"pilot",verification:"verified-staging",documentationReference:"docs/operations/INTEGRATION_PLATFORM.md"},
  {id:"openai",displayName:"OpenAI",category:"other",capabilities:[],authentication:"api-key",operations:["verify","health-check","push","disconnect"],releaseStage:"staging-only",verification:"contract-only"},
  {id:"vin-solutions",displayName:"VinSolutions",category:"crm",capabilities:["lead:read","customer:read","appointment:read"],authentication:"oauth2",operations:[],releaseStage:"disabled",verification:"contract-only"},
  {id:"dealerflow-stub",displayName:"DealerFlow Connector Test Harness",category:"other",capabilities:["lead:read","inventory:read"],authentication:"none",operations:["verify","health-check","pull","handle-webhook"],releaseStage:"internal-development",verification:"stub"},
];

export class ProviderRegistry {
  list(options:{includeInternal?:boolean}={}):readonly ProviderDefinition[]{return definitions.filter((provider)=>options.includeInternal||provider.releaseStage!=="internal-development")}
  require(providerId:string):ProviderDefinition{const provider=definitions.find((item)=>item.id===providerId);if(!provider)throw new ConnectorPlatformError("tenant-config","Unknown integration provider.",false);return provider}
}

export class ConnectorExecutor {
  constructor(private readonly registry:ProviderRegistry,private readonly credentialResolver:ConnectorCredentialResolver){}
  async verify(connector:ExternalConnector,context:TenantIntegrationContext){const provider=this.assertOperation(connector,"verify");const credentials=await this.credentials(provider,context);return connector.verify!(context,credentials)}
  async healthCheck(connector:ExternalConnector,context:TenantIntegrationContext){const provider=this.assertOperation(connector,"health-check");const credentials=await this.credentials(provider,context);return connector.healthCheck!(context,credentials)}
  async pull(connector:ExternalConnector,context:TenantIntegrationContext,checkpoint?:string){const provider=this.assertOperation(connector,"pull");const credentials=await this.credentials(provider,context);return connector.pull!(context,credentials,checkpoint)}
  async handleWebhook(connector:ExternalConnector,context:TenantIntegrationContext,payload:unknown){this.assertOperation(connector,"handle-webhook");return connector.handleWebhook!(context,payload)}
  private assertOperation(connector:ExternalConnector,operation:ConnectorOperation){const provider=this.registry.require(connector.providerId);const implementation=operation==="health-check"?connector.healthCheck:operation==="handle-webhook"?connector.handleWebhook:connector[operation as keyof ExternalConnector];if(!provider.operations.includes(operation)||typeof implementation!=="function")throw new UnsupportedConnectorOperationError(provider.id,operation);return provider}
  private async credentials(provider:ProviderDefinition,context:TenantIntegrationContext){if(provider.authentication==="none")return{};if(!context.credentialReference)throw new ConnectorPlatformError("tenant-config","A server-side credential reference is required.",false);return this.credentialResolver.resolve(context.credentialReference,{organizationId:context.organizationId,integrationId:context.integrationId})}
}

export type AuthorityPolicy="external-wins"|"dealerflow-wins"|"newest-wins"|"review-required";
export function resolveAuthorityConflict(input:{policy:AuthorityPolicy;externalValue:unknown;dealerFlowValue:unknown;externalObservedAt?:string;dealerFlowUpdatedAt?:string}){
  if(Object.is(input.externalValue,input.dealerFlowValue))return{decision:"unchanged" as const,value:input.dealerFlowValue};
  if(input.policy==="external-wins")return{decision:"external" as const,value:input.externalValue};
  if(input.policy==="dealerflow-wins")return{decision:"dealerflow" as const,value:input.dealerFlowValue};
  if(input.policy==="newest-wins"&&input.externalObservedAt&&input.dealerFlowUpdatedAt)return new Date(input.externalObservedAt)>new Date(input.dealerFlowUpdatedAt)?{decision:"external" as const,value:input.externalValue}:{decision:"dealerflow" as const,value:input.dealerFlowValue};
  return{decision:"review" as const};
}
