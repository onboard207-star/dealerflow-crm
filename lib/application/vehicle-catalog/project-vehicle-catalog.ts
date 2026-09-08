import { createHash } from "node:crypto";
import { generateEntityId } from "@/lib/core/identifiers";
import { validateVehicleCatalogManifest, type ValidatedVehicleCatalogNode, type VehicleCatalogManifest } from "./vehicle-catalog";

export interface VehicleCatalogReconciliation {
  releaseId: string;
  manifestSha256: string;
  counts: Readonly<Record<string, number>>;
  created: number;
  updated: number;
  unchanged: number;
  supersededReleaseId?: string;
}
export interface VehicleCatalogProjectionSession {
  lock(sourceSystem:string,sourceDataset:string):Promise<void>;
  findAcceptedRelease(sourceSystem:string,sourceDataset:string):Promise<string|undefined>;
  findReleaseByManifest(manifestSha256:string):Promise<VehicleCatalogReconciliation|undefined>;
  createRelease(input:{id:string;sourceSystem:string;sourceDataset:string;sourceRevision:string;manifestSha256:string;manifest:VehicleCatalogManifest;counts:Readonly<Record<string,number>>}):Promise<void>;
  upsertNodes(releaseId:string,nodes:readonly ValidatedVehicleCatalogNode[]):Promise<{created:number;updated:number;unchanged:number}>;
  replaceLinks(releaseId:string,nodes:readonly ValidatedVehicleCatalogNode[]):Promise<void>;
  acceptRelease(releaseId:string,previousReleaseId?:string):Promise<void>;
}
export interface VehicleCatalogProjectionProvider { transaction<T>(operation:(session:VehicleCatalogProjectionSession)=>Promise<T>):Promise<T>; }

export class VehicleCatalogProjectionService {
  constructor(private readonly provider:VehicleCatalogProjectionProvider){}
  async project(manifest:VehicleCatalogManifest):Promise<VehicleCatalogReconciliation>{
    const nodes=validateVehicleCatalogManifest(manifest);
    const manifestSha256=createHash("sha256").update(JSON.stringify({sourceSystem:manifest.sourceSystem,sourceDataset:manifest.sourceDataset,sourceRevision:manifest.sourceRevision,nodes})).digest("hex");
    const counts=countKinds(nodes);
    return this.provider.transaction(async session=>{
      await session.lock(manifest.sourceSystem,manifest.sourceDataset);
      const replay=await session.findReleaseByManifest(manifestSha256);
      if(replay)return replay;
      const previousReleaseId=await session.findAcceptedRelease(manifest.sourceSystem,manifest.sourceDataset);
      const releaseId=generateEntityId("vcr");
      await session.createRelease({id:releaseId,sourceSystem:manifest.sourceSystem,sourceDataset:manifest.sourceDataset,sourceRevision:manifest.sourceRevision,manifestSha256,manifest,counts});
      const result=await session.upsertNodes(releaseId,nodes);
      await session.replaceLinks(releaseId,nodes);
      await session.acceptRelease(releaseId,previousReleaseId);
      return{releaseId,manifestSha256,counts,...result,...(previousReleaseId?{supersededReleaseId:previousReleaseId}:{})};
    });
  }
}
function countKinds(nodes:readonly ValidatedVehicleCatalogNode[]){const counts:Record<string,number>={};for(const node of nodes){const kind=node.id.slice(0,3);counts[kind]=(counts[kind]??0)+1;}return counts;}
