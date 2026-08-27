import { parseServerEnvironment } from "@/lib/server/config";
import { getDatabasePool } from "@/lib/server/database";
import { InventoryMediaManager } from "./inventory-media-manager";
import { R2InventoryMediaStorage } from "./r2-media-storage";

export function createInventoryMediaManager() {
  const environment=parseServerEnvironment(process.env,{database:true,media:true});
  if(!environment.r2AccountId||!environment.r2AccessKeyId||!environment.r2SecretAccessKey||!environment.r2Bucket||!environment.r2PublicBaseUrl)throw new Error("Inventory media storage is unavailable.");
  return new InventoryMediaManager(getDatabasePool(),new R2InventoryMediaStorage({accountId:environment.r2AccountId,accessKeyId:environment.r2AccessKeyId,secretAccessKey:environment.r2SecretAccessKey,bucket:environment.r2Bucket,publicBaseUrl:environment.r2PublicBaseUrl}));
}
export function inventoryMediaStorageAvailable(){try{const environment=parseServerEnvironment(process.env);return environment.mediaProvider==="r2"&&Boolean(environment.r2AccountId&&environment.r2AccessKeyId&&environment.r2SecretAccessKey&&environment.r2Bucket&&environment.r2PublicBaseUrl);}catch{return false;}}
