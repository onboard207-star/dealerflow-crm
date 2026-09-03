import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export type VehicleCostSourceType = "dms" | "accounting" | "invoice" | "acquisition" | "manual-documented";

export interface QuoteProfitabilitySnapshot extends OrganizationScope {
  id: string;
  quoteId: string;
  inventoryUnitId: string;
  inventoryCostSnapshotId: string;
  packPolicyId?: string;
  vehicleSellCents: number;
  vehicleCostCents: number;
  packCents: number;
  frontGrossCents: number;
  backendGrossCents: number;
  totalGrossCents: number;
  capturedAt: string;
}

export interface CaptureQuoteProfitabilityRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  quoteId: string;
  vehicleCostCents: number;
  costSourceType: VehicleCostSourceType;
  costSourceLabel: string;
  costSourceReference?: string;
  costEffectiveAt: string;
}

export interface QuoteProfitabilitySession {
  getQuoteContext(scope: OrganizationScope, quoteId: string): Promise<{ status: string; locationId: string; inventoryUnitId?: string; vehicleSellCents: number } | null>;
  getPackPolicy(scope: OrganizationScope, locationId: string): Promise<{ id: string; enabled: boolean; packAmountCents?: number } | null>;
  getBackendGross(scope: OrganizationScope, quoteId: string): Promise<number>;
  snapshotExists(scope: OrganizationScope, quoteId: string): Promise<boolean>;
  createSnapshot(context: RequestContext, input: { costSnapshot: { id: string; inventoryUnitId: string; costCents: number; sourceType: VehicleCostSourceType; sourceLabel: string; sourceReference?: string; effectiveAt: string; capturedAt: string }; profitability: QuoteProfitabilitySnapshot }): Promise<QuoteProfitabilitySnapshot>;
}

export interface QuoteProfitabilityProvider {
  transaction<Result>(operation: (session: QuoteProfitabilitySession) => Promise<Result>): Promise<Result>;
}

export class QuoteProfitabilityValidationError extends Error {
  constructor(readonly issues: readonly string[]) { super("Quote profitability data is invalid."); this.name = "QuoteProfitabilityValidationError"; }
}
export class QuoteProfitabilityIntegrityError extends Error {
  constructor(message: string) { super(message); this.name = "QuoteProfitabilityIntegrityError"; }
}

export class QuoteProfitabilityService {
  constructor(private readonly provider: QuoteProfitabilityProvider, private readonly now: () => Date = () => new Date()) {}

  async capture(request: CaptureQuoteProfitabilityRequest): Promise<QuoteProfitabilitySnapshot> {
    validate(request);
    authorize(request.actor, request.organizationId, request.locationId);
    return this.provider.transaction(async (session) => {
      const quote = await session.getQuoteContext(request, request.quoteId);
      if (!quote) throw new QuoteProfitabilityIntegrityError("The Quote is unavailable.");
      authorize(request.actor, request.organizationId, quote.locationId);
      if (!quote.inventoryUnitId) throw new QuoteProfitabilityIntegrityError("An inventory unit is required before profitability can be captured.");
      if (await session.snapshotExists(request, request.quoteId)) throw new QuoteProfitabilityIntegrityError("Profitability is immutable for this Quote version. Create a revised Quote to recalculate it.");
      const policy = await session.getPackPolicy(request, quote.locationId);
      if (policy?.enabled && policy.packAmountCents === undefined) throw new QuoteProfitabilityIntegrityError("The enabled pack policy has no configured amount.");
      const packCents = policy?.enabled ? policy.packAmountCents ?? 0 : 0;
      const backendGrossCents = await session.getBackendGross(request, request.quoteId);
      const calculated = calculateQuoteProfitability({ vehicleSellCents: quote.vehicleSellCents, vehicleCostCents: request.vehicleCostCents, packCents, backendGrossCents });
      const capturedAt = this.now().toISOString();
      const costSnapshot = {
        id: generateEntityId("ics"), inventoryUnitId: quote.inventoryUnitId, costCents: request.vehicleCostCents,
        sourceType: request.costSourceType, sourceLabel: request.costSourceLabel.trim(),
        ...(request.costSourceReference?.trim() ? { sourceReference: request.costSourceReference.trim() } : {}),
        effectiveAt: new Date(request.costEffectiveAt).toISOString(), capturedAt,
      };
      const profitability: QuoteProfitabilitySnapshot = {
        id: generateEntityId("qpf"), organizationId: request.organizationId, locationId: quote.locationId,
        quoteId: request.quoteId, inventoryUnitId: quote.inventoryUnitId, inventoryCostSnapshotId: costSnapshot.id,
        ...(policy?.enabled ? { packPolicyId: policy.id } : {}), ...calculated, capturedAt,
      };
      return session.createSnapshot(context(request, quote.locationId), { costSnapshot, profitability });
    });
  }
}

export function calculateQuoteProfitability(input: { vehicleSellCents: number; vehicleCostCents: number; packCents: number; backendGrossCents: number }) {
  for (const [key, value] of Object.entries(input)) if (!Number.isSafeInteger(value) || (key !== "backendGrossCents" && value < 0)) throw new QuoteProfitabilityValidationError([`${key} is invalid.`]);
  const frontGrossCents = input.vehicleSellCents - input.vehicleCostCents - input.packCents;
  return { ...input, frontGrossCents, totalGrossCents: frontGrossCents + input.backendGrossCents };
}

function validate(request: CaptureQuoteProfitabilityRequest) {
  const issues: string[] = [];
  if (!request.quoteId.trim()) issues.push("quoteId is required.");
  if (!Number.isSafeInteger(request.vehicleCostCents) || request.vehicleCostCents < 0) issues.push("vehicleCostCents is invalid.");
  if (!request.costSourceLabel.trim() || request.costSourceLabel.trim().length > 200) issues.push("costSourceLabel is invalid.");
  if (request.costSourceReference && request.costSourceReference.trim().length > 500) issues.push("costSourceReference is invalid.");
  if (Number.isNaN(new Date(request.costEffectiveAt).valueOf())) issues.push("costEffectiveAt is invalid.");
  if (issues.length) throw new QuoteProfitabilityValidationError(issues);
}
function authorize(actor: AuthorizationActor, organizationId: string, locationId?: string) { for (const capability of ["deal.read", "quote.revise", "quote.view_sensitive_terms"] as const) assertAuthorized(actor, { capability, organizationId, locationId }); }
function context(request: CaptureQuoteProfitabilityRequest, locationId: string): RequestContext { return { actorId: request.actor.userId, organizationId: request.organizationId, locationId, correlationId: request.correlationId }; }
