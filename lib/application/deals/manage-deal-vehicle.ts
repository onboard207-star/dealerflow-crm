import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export interface DealVehicleChangeEvent extends OrganizationScope {
  id: string;
  dealId: string;
  customerId: string;
  leadId: string;
  fromVehicleId: string;
  fromInventoryUnitId?: string;
  toVehicleId: string;
  toInventoryUnitId: string;
  reason: string;
  invalidatedQuoteIds: readonly string[];
  occurredAt: string;
  idempotencyKey: string;
}

export interface ChangeDealVehicleRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  idempotencyKey: string;
  dealId: string;
  customerId: string;
  leadId: string;
  toVehicleId: string;
  toInventoryUnitId: string;
  reason: string;
}

interface DealVehicleChangeContext {
  locationId: string;
  status: string;
  fromVehicleId: string;
  fromInventoryUnitId?: string;
  blockingReason?: string;
}

export interface DealVehicleChangeSession {
  lock(scope: OrganizationScope, key: string): Promise<void>;
  findByIdempotency(scope: OrganizationScope, key: string): Promise<DealVehicleChangeEvent | null>;
  getContext(
    scope: OrganizationScope,
    input: Pick<ChangeDealVehicleRequest, "dealId" | "customerId" | "leadId" | "toVehicleId" | "toInventoryUnitId">,
  ): Promise<DealVehicleChangeContext | null>;
  change(context: RequestContext, event: DealVehicleChangeEvent): Promise<void>;
}

export interface DealVehicleChangeProvider {
  transaction<T>(operation: (session: DealVehicleChangeSession) => Promise<T>): Promise<T>;
}

export class DealVehicleChangeValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Deal vehicle change data is invalid.");
    this.name = "DealVehicleChangeValidationError";
  }
}

export class DealVehicleChangeIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DealVehicleChangeIntegrityError";
  }
}

export class DealVehicleChangeService {
  constructor(
    private readonly provider: DealVehicleChangeProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async change(request: ChangeDealVehicleRequest) {
    validate(request);
    for (const capability of ["deal.read", "deal.update", "customer.read", "lead.read", "inventory.read"] as const) {
      assertAuthorized(request.actor, {
        organizationId: request.organizationId,
        locationId: request.locationId,
        capability,
      });
    }

    return this.provider.transaction(async (session) => {
      await session.lock(request, request.idempotencyKey);
      const replay = await session.findByIdempotency(request, request.idempotencyKey);
      if (replay) return { event: replay, changed: false };

      await session.lock(request, `deal-vehicle:${request.dealId}`);
      const resolved = await session.getContext(request, request);
      if (!resolved) {
        throw new DealVehicleChangeIntegrityError(
          "The Deal, Customer, Lead, target Vehicle, or available Inventory Unit context is unavailable.",
        );
      }
      for (const capability of ["deal.read", "deal.update", "inventory.read"] as const) {
        assertAuthorized(request.actor, {
          organizationId: request.organizationId,
          locationId: resolved.locationId,
          capability,
        });
      }
      if (resolved.blockingReason) throw new DealVehicleChangeIntegrityError(resolved.blockingReason);
      if (!["draft", "working"].includes(resolved.status)) {
        throw new DealVehicleChangeIntegrityError("Vehicle changes are allowed only while the Deal is draft or working.");
      }
      if (
        resolved.fromVehicleId === request.toVehicleId &&
        resolved.fromInventoryUnitId === request.toInventoryUnitId
      ) {
        throw new DealVehicleChangeIntegrityError("The target Vehicle is already authoritative for this Deal.");
      }

      const event: DealVehicleChangeEvent = {
        id: generateEntityId("dvc"),
        organizationId: request.organizationId,
        locationId: resolved.locationId,
        dealId: request.dealId,
        customerId: request.customerId,
        leadId: request.leadId,
        fromVehicleId: resolved.fromVehicleId,
        ...(resolved.fromInventoryUnitId ? { fromInventoryUnitId: resolved.fromInventoryUnitId } : {}),
        toVehicleId: request.toVehicleId,
        toInventoryUnitId: request.toInventoryUnitId,
        reason: request.reason.trim(),
        invalidatedQuoteIds: [],
        occurredAt: this.now().toISOString(),
        idempotencyKey: request.idempotencyKey,
      };
      await session.change(toRequestContext(request, resolved.locationId), event);
      const stored = await session.findByIdempotency(request, request.idempotencyKey);
      if (!stored) throw new DealVehicleChangeIntegrityError("Deal vehicle-change evidence was not retained.");
      return { event: stored, changed: true };
    });
  }
}

function validate(request: ChangeDealVehicleRequest) {
  const issues: string[] = [];
  for (const [key, value] of Object.entries({
    dealId: request.dealId,
    customerId: request.customerId,
    leadId: request.leadId,
    toVehicleId: request.toVehicleId,
    toInventoryUnitId: request.toInventoryUnitId,
    idempotencyKey: request.idempotencyKey,
    reason: request.reason,
  })) {
    if (!value.trim()) issues.push(`${key} is required.`);
  }
  if (request.reason.length > 1000) issues.push("reason must not exceed 1000 characters.");
  if (issues.length) throw new DealVehicleChangeValidationError(issues);
}

function toRequestContext(request: ChangeDealVehicleRequest, locationId: string): RequestContext {
  return {
    actorId: request.actor.userId,
    organizationId: request.organizationId,
    locationId,
    correlationId: request.correlationId,
  };
}
