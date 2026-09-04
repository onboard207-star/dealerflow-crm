import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { InventoryCostSnapshot } from "@/lib/application/inventory";
import { resolveEffectivePackPolicy, type PackPolicy } from "./manage-pack-policy";

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
}

export interface QuoteProfitabilitySession {
  getQuoteContext(scope: OrganizationScope, quoteId: string): Promise<{ status: string; locationId: string; inventoryUnitId?: string; vehicleSellCents: number } | null>;
  getPackPolicies(scope: OrganizationScope, locationId: string): Promise<{ organizationDefault: PackPolicy | null; locationOverride: PackPolicy | null }>;
  getLatestInventoryCost(scope: OrganizationScope, inventoryUnitId: string): Promise<InventoryCostSnapshot | null>;
  getBackendGross(scope: OrganizationScope, quoteId: string): Promise<number>;
  snapshotExists(scope: OrganizationScope, quoteId: string): Promise<boolean>;
  createSnapshot(context: RequestContext, profitability: QuoteProfitabilitySnapshot): Promise<QuoteProfitabilitySnapshot>;
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
      const costSnapshot = await session.getLatestInventoryCost(request, quote.inventoryUnitId);
      if (!costSnapshot) throw new QuoteProfitabilityIntegrityError("Authoritative inventory cost is unavailable.");
      const resolvedPack = resolveEffectivePackPolicy(await session.getPackPolicies(request, quote.locationId));
      const packCents = resolvedPack.amountCents;
      const backendGrossCents = await session.getBackendGross(request, request.quoteId);
      const calculated = calculateQuoteProfitability({ vehicleSellCents: quote.vehicleSellCents, vehicleCostCents: costSnapshot.costCents, packCents, backendGrossCents });
      const capturedAt = this.now().toISOString();
      const profitability: QuoteProfitabilitySnapshot = {
        id: generateEntityId("qpf"), organizationId: request.organizationId, locationId: quote.locationId,
        quoteId: request.quoteId, inventoryUnitId: quote.inventoryUnitId, inventoryCostSnapshotId: costSnapshot.id,
        ...(resolvedPack.source !== "no-enabled-policy" ? { packPolicyId: resolvedPack.policyId } : {}), ...calculated, capturedAt,
      };
      return session.createSnapshot(context(request, quote.locationId), profitability);
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
  if (issues.length) throw new QuoteProfitabilityValidationError(issues);
}
function authorize(actor: AuthorizationActor, organizationId: string, locationId?: string) { for (const capability of ["deal.read", "quote.revise", "quote.view_sensitive_terms"] as const) assertAuthorized(actor, { capability, organizationId, locationId }); }
function context(request: CaptureQuoteProfitabilityRequest, locationId: string): RequestContext { return { actorId: request.actor.userId, organizationId: request.organizationId, locationId, correlationId: request.correlationId }; }
