import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export const inventoryCostSourceTypes = [
  "manual-verified",
  "dms-import",
  "accounting-import",
  "oem-invoice",
  "migration-import",
] as const;

export type InventoryCostSourceType = (typeof inventoryCostSourceTypes)[number] | "dms" | "accounting" | "invoice" | "acquisition" | "manual-documented";

export interface InventoryCostSnapshot extends OrganizationScope {
  id: string;
  inventoryUnitId: string;
  version: number;
  previousSnapshotId?: string;
  costCents: number;
  sourceType: InventoryCostSourceType;
  sourceLabel: string;
  sourceReference?: string;
  effectiveAt: string;
  capturedAt: string;
  capturedBy: string;
}

export interface RecordInventoryCostRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  inventoryUnitId: string;
  costCents: number;
  sourceType: (typeof inventoryCostSourceTypes)[number];
  sourceLabel: string;
  sourceReference?: string;
  effectiveAt: string;
}

export interface InventoryCostSession {
  getInventoryUnit(scope: OrganizationScope, inventoryUnitId: string): Promise<{ locationId: string } | null>;
  getLatest(scope: OrganizationScope, inventoryUnitId: string): Promise<InventoryCostSnapshot | null>;
  insert(context: RequestContext, snapshot: InventoryCostSnapshot): Promise<InventoryCostSnapshot>;
}

export interface InventoryCostProvider {
  transaction<Result>(operation: (session: InventoryCostSession) => Promise<Result>): Promise<Result>;
}

export class InventoryCostValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Inventory cost data is invalid.");
    this.name = "InventoryCostValidationError";
  }
}

export class InventoryCostIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryCostIntegrityError";
  }
}

/** Single authoritative write boundary for manual and future provider-sourced vehicle cost. */
export class InventoryCostService {
  constructor(
    private readonly provider: InventoryCostProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(request: RecordInventoryCostRequest): Promise<InventoryCostSnapshot> {
    validate(request);
    assertAuthorized(request.actor, { capability: "inventory.read", organizationId: request.organizationId });
    assertAuthorized(request.actor, { capability: "inventory.cost.manage", organizationId: request.organizationId });

    return this.provider.transaction(async (session) => {
      const unit = await session.getInventoryUnit(request, request.inventoryUnitId);
      if (!unit) throw new InventoryCostIntegrityError("The inventory unit is unavailable.");
      assertAuthorized(request.actor, {
        capability: "inventory.cost.manage",
        organizationId: request.organizationId,
        locationId: unit.locationId,
      });
      if (unit.locationId !== request.locationId) {
        throw new InventoryCostIntegrityError("The inventory unit does not belong to the requested location.");
      }
      const previous = await session.getLatest(request, request.inventoryUnitId);
      const snapshot: InventoryCostSnapshot = {
        id: generateEntityId("ics"),
        organizationId: request.organizationId,
        locationId: unit.locationId,
        inventoryUnitId: request.inventoryUnitId,
        version: (previous?.version ?? 0) + 1,
        ...(previous ? { previousSnapshotId: previous.id } : {}),
        costCents: request.costCents,
        sourceType: request.sourceType,
        sourceLabel: request.sourceLabel.trim(),
        ...(request.sourceReference?.trim() ? { sourceReference: request.sourceReference.trim() } : {}),
        effectiveAt: new Date(request.effectiveAt).toISOString(),
        capturedAt: this.now().toISOString(),
        capturedBy: request.actor.userId,
      };
      return session.insert(
        {
          actorId: request.actor.userId,
          organizationId: request.organizationId,
          locationId: unit.locationId,
          correlationId: request.correlationId,
        },
        snapshot,
      );
    });
  }
}

function validate(request: RecordInventoryCostRequest) {
  const issues: string[] = [];
  if (!request.inventoryUnitId.trim()) issues.push("inventoryUnitId is required.");
  if (!Number.isSafeInteger(request.costCents) || request.costCents < 0) issues.push("costCents is invalid.");
  if (!inventoryCostSourceTypes.includes(request.sourceType)) issues.push("sourceType is invalid.");
  if (!request.sourceLabel.trim() || request.sourceLabel.trim().length > 200) issues.push("sourceLabel is invalid.");
  if (request.sourceReference && (!request.sourceReference.trim() || request.sourceReference.trim().length > 500)) issues.push("sourceReference is invalid.");
  if (Number.isNaN(new Date(request.effectiveAt).valueOf())) issues.push("effectiveAt is invalid.");
  if (issues.length) throw new InventoryCostValidationError(issues);
}
