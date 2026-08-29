import { describe, expect, it, vi } from "vitest";

import type { AuthorizationActor } from "@/lib/platform/auth";
import type { DatabaseClient, DatabasePool } from "@/lib/server/database";
import { InventoryMediaManager } from "./inventory-media-manager";
import type { R2InventoryMediaStorage } from "./r2-media-storage";

const organizationId="org_dealerflow",locationId="loc_main";
function actor(capabilities:AuthorizationActor["memberships"][number]["capabilities"]=["inventory.read","inventory.update"]):AuthorizationActor{return{userId:"usr_inventory",memberships:[{organizationId,locationIds:[locationId],capabilities}]};}
const storage={} as R2InventoryMediaStorage;

describe("InventoryMediaManager primary selection",()=>{
  it("sets one authorized exact-unit photo as primary",async()=>{const query=vi.fn<DatabaseClient["query"]>().mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{id:"ima_old",location_id:locationId,is_primary:true},{id:"ima_new",location_id:locationId,is_primary:false}]}).mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({});const client:DatabaseClient={query,release:vi.fn()};const pool:DatabasePool={connect:vi.fn().mockResolvedValue(client)};const result=await new InventoryMediaManager(pool,storage).setPrimary({actor:actor(),organizationId,inventoryUnitId:"inv_vehicle",mediaId:"ima_new"});expect(result).toEqual({changed:true});expect(query.mock.calls.some(([sql])=>String(sql).includes("SET is_primary=false"))).toBe(true);expect(query.mock.calls.some(([sql])=>String(sql).includes("SET is_primary=true"))).toBe(true);});
  it("denies primary changes without inventory update capability",async()=>{const pool={connect:vi.fn()} as unknown as DatabasePool;await expect(new InventoryMediaManager(pool,storage).setPrimary({actor:actor(["inventory.read"]),organizationId,inventoryUnitId:"inv_vehicle",mediaId:"ima_new"})).rejects.toMatchObject({name:"AuthorizationError",reason:"capability-required"});expect(pool.connect).not.toHaveBeenCalled();});
  it("denies cross-organization primary changes before database access",async()=>{const pool={connect:vi.fn()} as unknown as DatabasePool;await expect(new InventoryMediaManager(pool,storage).setPrimary({actor:actor(),organizationId:"org_other",inventoryUnitId:"inv_vehicle",mediaId:"ima_new"})).rejects.toMatchObject({name:"AuthorizationError",reason:"organization-membership-required"});expect(pool.connect).not.toHaveBeenCalled();});
});
