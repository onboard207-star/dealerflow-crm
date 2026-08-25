import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import {
  resolveTenantConfiguration,
  type TenantConfiguration,
  type TenantConfigurationInput,
} from "@/lib/platform/tenant";

export interface VersionedTenantConfiguration {
  configuration: TenantConfiguration;
  version: string;
}

export interface TenantConfigurationProvider {
  read(input: { actorId: string; organizationId: string }): Promise<VersionedTenantConfiguration>;
  save(input: { actorId: string; organizationId: string; expectedVersion: string; configuration: TenantConfiguration }): Promise<boolean>;
  history(input:{actorId:string;organizationId:string}):Promise<readonly TenantConfigurationVersion[]>;
  restore(input:{actorId:string;organizationId:string;expectedVersion:string;versionId:string}):Promise<boolean>;
}
export interface TenantConfigurationVersion { id:string;changeKind:"update"|"rollback";productName:string;createdAt:string }

export class ManageTenantConfigurationService {
  constructor(private readonly provider: TenantConfigurationProvider) {}

  read(actor: AuthorizationActor, organizationId: string) {
    assertAuthorized(actor, { capability: "organization.configure", organizationId });
    return this.provider.read({ actorId: actor.userId, organizationId });
  }

  async update(input: {
    actor: AuthorizationActor;
    organizationId: string;
    expectedVersion: string;
    configuration: TenantConfigurationInput;
  }) {
    assertAuthorized(input.actor, { capability: "organization.configure", organizationId: input.organizationId });
    if (input.configuration.id !== input.organizationId) throw new Error("Tenant identity cannot be changed.");
    const configuration = resolveTenantConfiguration(input.configuration);
    const saved = await this.provider.save({ actorId: input.actor.userId, organizationId: input.organizationId, expectedVersion: input.expectedVersion, configuration });
    if (!saved) throw new TenantConfigurationConflictError();
    return configuration;
  }
  history(actor:AuthorizationActor,organizationId:string){assertAuthorized(actor,{capability:"organization.configure",organizationId});return this.provider.history({actorId:actor.userId,organizationId});}
  async restore(input:{actor:AuthorizationActor;organizationId:string;expectedVersion:string;versionId:string}){assertAuthorized(input.actor,{capability:"organization.configure",organizationId:input.organizationId});if(!/^ocv_[a-z0-9_-]{6,64}$/.test(input.versionId))throw new Error("Configuration version is invalid.");if(!await this.provider.restore({actorId:input.actor.userId,organizationId:input.organizationId,expectedVersion:input.expectedVersion,versionId:input.versionId}))throw new TenantConfigurationConflictError();}
}

export class TenantConfigurationConflictError extends Error {
  constructor() { super("Tenant configuration changed while it was being edited."); this.name = "TenantConfigurationConflictError"; }
}
