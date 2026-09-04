import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export type DealStatus = "draft" | "working" | "pending-approval" | "approved" | "contracted" | "delivered" | "cancelled";
export type PurchaseType = "cash" | "finance" | "lease";
export interface DealRecord extends OrganizationScope { id: string; customerId: string; leadId: string; appointmentId?: string; showroomVisitId?: string; primaryVehicleId: string; inventoryUnitId?: string; ownerUserId?: string; dealNumber: string; status: DealStatus; purchaseType?: PurchaseType; agreedPriceCents?: number; idempotencyKey: string; }
export interface DealStatusEvent extends OrganizationScope { id: string; dealId: string; fromStatus?: DealStatus; toStatus: DealStatus; reason?: string; occurredAt: string; idempotencyKey: string; }
export interface CreateDealRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string; idempotencyKey: string; customerId: string; leadId: string; appointmentId?: string; showroomVisitId?: string; primaryVehicleId: string; inventoryUnitId?: string; ownerUserId?: string; purchaseType?: PurchaseType; agreedPriceCents?: number; }
export interface TransitionDealRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string; idempotencyKey: string; dealId: string; toStatus: DealStatus; reason?: string; }

export interface DealSession {
  acquireIdempotencyLock(scope: OrganizationScope, key: string): Promise<void>;
  findDealByIdempotency(scope: OrganizationScope, key: string): Promise<DealRecord | null>;
  creationContextExists(scope: OrganizationScope, input: { customerId: string; leadId: string; appointmentId?: string; showroomVisitId?: string; vehicleId: string; inventoryUnitId?: string; ownerUserId?: string }): Promise<boolean>;
  createDeal(context: RequestContext, deal: DealRecord, event: DealStatusEvent): Promise<DealRecord>;
  findTransitionByIdempotency(scope: OrganizationScope, key: string): Promise<{ deal: DealRecord; event: DealStatusEvent } | null>;
  getDealForUpdate(scope: OrganizationScope, dealId: string): Promise<DealRecord | null>;
  deliveryCompleted(scope: OrganizationScope, dealId: string): Promise<boolean>;
  transitionDeal(context: RequestContext, deal: DealRecord, event: DealStatusEvent): Promise<DealRecord>;
}
export interface DealProvider { transaction<Result>(operation: (session: DealSession) => Promise<Result>): Promise<Result>; }
export class DealValidationError extends Error { constructor(readonly issues: readonly string[]) { super("Deal data is invalid."); this.name = "DealValidationError"; } }
export class DealIntegrityError extends Error { constructor(message: string) { super(message); this.name = "DealIntegrityError"; } }
export class DealTransitionError extends Error { constructor(readonly from: DealStatus, readonly to: DealStatus) { super(`Deal cannot transition from ${from} to ${to}.`); this.name = "DealTransitionError"; } }

export class DealService {
  constructor(private readonly provider: DealProvider) {}
  async create(request: CreateDealRequest): Promise<{ deal: DealRecord; created: boolean }> {
    validateCreate(request); for (const capability of ["deal.create", "deal.read", "lead.read", "customer.read", "inventory.read"] as const) assertAuthorized(request.actor, { capability, organizationId: request.organizationId, locationId: request.locationId });
    return this.provider.transaction(async (session) => { await session.acquireIdempotencyLock(request, request.idempotencyKey); const existing = await session.findDealByIdempotency(request, request.idempotencyKey); if (existing) return { deal: existing, created: false };
      if (!await session.creationContextExists(request, { customerId: request.customerId, leadId: request.leadId, ...(request.appointmentId ? { appointmentId: request.appointmentId } : {}), ...(request.showroomVisitId ? { showroomVisitId: request.showroomVisitId } : {}), vehicleId: request.primaryVehicleId, ...(request.inventoryUnitId ? { inventoryUnitId: request.inventoryUnitId } : {}), ...(request.ownerUserId ? { ownerUserId: request.ownerUserId } : {}) })) throw new DealIntegrityError("The customer, lead, appointment, showroom visit, vehicle, inventory, or owner context is unavailable.");
      const id = generateEntityId("dea"); const deal: DealRecord = { id, organizationId: request.organizationId, locationId: request.locationId!, customerId: request.customerId, leadId: request.leadId, ...(request.appointmentId ? { appointmentId: request.appointmentId } : {}), ...(request.showroomVisitId ? { showroomVisitId: request.showroomVisitId } : {}), primaryVehicleId: request.primaryVehicleId,
        ...(request.inventoryUnitId ? { inventoryUnitId: request.inventoryUnitId } : {}), ...(request.ownerUserId ? { ownerUserId: request.ownerUserId } : {}), dealNumber: `DF-${id.slice(-8).toUpperCase()}`, status: "draft",
        ...(request.purchaseType ? { purchaseType: request.purchaseType } : {}), ...(request.agreedPriceCents !== undefined ? { agreedPriceCents: request.agreedPriceCents } : {}), idempotencyKey: request.idempotencyKey };
      return { deal: await session.createDeal(context(request), deal, { id: generateEntityId("dst"), organizationId: request.organizationId, locationId: request.locationId!, dealId: id, toStatus: "draft", occurredAt: new Date().toISOString(), idempotencyKey: `create:${request.idempotencyKey}` }), created: true };
    });
  }
  async transition(request: TransitionDealRequest): Promise<{ deal: DealRecord; event: DealStatusEvent; transitioned: boolean }> {
    validateTransition(request); const transitionCapability = request.toStatus === "approved" ? "deal.approve" : "deal.update"; assertAuthorized(request.actor, { capability: transitionCapability, organizationId: request.organizationId }); assertAuthorized(request.actor, { capability: "deal.read", organizationId: request.organizationId });
    return this.provider.transaction(async (session) => { await session.acquireIdempotencyLock(request, request.idempotencyKey); const existing = await session.findTransitionByIdempotency(request, request.idempotencyKey); if (existing) { authorizeDealLocation(request.actor, request.organizationId, existing.deal.locationId, transitionCapability); return { ...existing, transitioned: false }; } const deal = await session.getDealForUpdate(request, request.dealId); if (!deal) throw new DealIntegrityError("The deal is unavailable."); authorizeDealLocation(request.actor, request.organizationId, deal.locationId, transitionCapability);
      if (!allowedTransitions[deal.status].includes(request.toStatus)) throw new DealTransitionError(deal.status, request.toStatus); if (request.toStatus === "delivered" && !await session.deliveryCompleted(request, deal.id)) throw new DealIntegrityError("A completed delivery handoff is required before the Deal can be delivered."); if ((request.toStatus === "cancelled" || request.toStatus === "working") && deal.status !== "draft" && !request.reason?.trim()) throw new DealValidationError(["reason is required for rollback or cancellation."]);
      const event: DealStatusEvent = { id: generateEntityId("dst"), organizationId: request.organizationId, ...(deal.locationId ? { locationId: deal.locationId } : {}), dealId: deal.id, fromStatus: deal.status, toStatus: request.toStatus, ...(request.reason?.trim() ? { reason: request.reason.trim() } : {}), occurredAt: new Date().toISOString(), idempotencyKey: request.idempotencyKey };
      return { deal: await session.transitionDeal(context(request), { ...deal, status: request.toStatus }, event), event, transitioned: true };
    });
  }
}

const allowedTransitions: Record<DealStatus, readonly DealStatus[]> = { draft: ["working", "cancelled"], working: ["pending-approval", "cancelled"], "pending-approval": ["approved", "working", "cancelled"], approved: ["contracted", "working", "cancelled"], contracted: ["delivered", "cancelled"], delivered: [], cancelled: [] };
function validateCreate(request: CreateDealRequest) { const issues: string[] = []; if (!request.locationId) issues.push("locationId is required."); for (const [field, value] of [["customerId", request.customerId], ["leadId", request.leadId], ["primaryVehicleId", request.primaryVehicleId], ["idempotencyKey", request.idempotencyKey]] as const) if (!value.trim()) issues.push(`${field} is required.`); if (request.showroomVisitId && !request.appointmentId) issues.push("appointmentId is required when showroomVisitId is supplied."); if (request.agreedPriceCents !== undefined && (!Number.isSafeInteger(request.agreedPriceCents) || request.agreedPriceCents < 0)) issues.push("agreedPriceCents must be a nonnegative integer."); if (issues.length) throw new DealValidationError(issues); }
function validateTransition(request: TransitionDealRequest) { const issues: string[] = []; if (!request.dealId.trim()) issues.push("dealId is required."); if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required."); if (request.reason && request.reason.trim().length > 1000) issues.push("reason must not exceed 1000 characters."); if (issues.length) throw new DealValidationError(issues); }
function context(request: { actor: AuthorizationActor; organizationId: string; locationId?: string; correlationId: string }): RequestContext { return { actorId: request.actor.userId, organizationId: request.organizationId, correlationId: request.correlationId, ...(request.locationId ? { locationId: request.locationId } : {}) }; }
function authorizeDealLocation(actor: AuthorizationActor, organizationId: string, locationId: string | undefined, capability: "deal.approve" | "deal.update") { assertAuthorized(actor, { capability, organizationId, locationId }); assertAuthorized(actor, { capability: "deal.read", organizationId, locationId }); }
