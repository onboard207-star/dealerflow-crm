import { describe,expect,it,vi } from "vitest";
import { ConnectorExecutor,ConnectorPlatformError,ProviderRegistry,UnsupportedConnectorOperationError,resolveAuthorityConflict,type ConnectorCredentialResolver,type TenantIntegrationContext } from "./connector-platform";
import { DealerFlowStubConnector } from "./stub-connector";
const context:TenantIntegrationContext={organizationId:"org_dealerflow",integrationId:"int_stub",correlationId:"test"};
const resolver:ConnectorCredentialResolver={resolve:vi.fn().mockResolvedValue({token:"secret"})};
describe("integration connector platform",()=>{
  it("keeps internal stub providers out of the dealer registry",()=>{const registry=new ProviderRegistry();expect(registry.list().map(item=>item.id)).not.toContain("dealerflow-stub");expect(registry.list({includeInternal:true}).map(item=>item.id)).toContain("dealerflow-stub")});
  it("marks VinSolutions disabled and does not claim operations",()=>{const provider=new ProviderRegistry().require("vin-solutions");expect(provider.releaseStage).toBe("disabled");expect(provider.operations).toEqual([])});
  it("fails unsupported operations explicitly",async()=>{const executor=new ConnectorExecutor(new ProviderRegistry(),resolver);await expect(executor.pull({providerId:"twilio"},context)).rejects.toBeInstanceOf(UnsupportedConnectorOperationError)});
  it("requires credential references for authenticated providers",async()=>{const executor=new ConnectorExecutor(new ProviderRegistry(),resolver);await expect(executor.verify({providerId:"openai",verify:vi.fn()},context)).rejects.toBeInstanceOf(ConnectorPlatformError)});
  it("never sends stub credentials to the resolver",async()=>{const local={resolve:vi.fn()};const executor=new ConnectorExecutor(new ProviderRegistry(),local);await executor.verify(new DealerFlowStubConnector("success"),context);expect(local.resolve).not.toHaveBeenCalled()});
  it("simulates deterministic duplicate deliveries",async()=>{const record={objectType:"lead",externalId:"lead-1",observedAt:new Date(0).toISOString(),attributes:{name:"Synthetic Lead"}};const result=await new ConnectorExecutor(new ProviderRegistry(),resolver).pull(new DealerFlowStubConnector("duplicate",[record]),context);expect(result.records).toHaveLength(2);expect(result.records[0]).toEqual(result.records[1])});
  it("routes ambiguous conflicts to review",()=>expect(resolveAuthorityConflict({policy:"review-required",externalValue:"A",dealerFlowValue:"B"})).toEqual({decision:"review"}));
  it("uses explicit object authority policies",()=>expect(resolveAuthorityConflict({policy:"external-wins",externalValue:"sold",dealerFlowValue:"available"})).toEqual({decision:"external",value:"sold"}));
});
