import { generateEntityId } from "@/lib/core/identifiers";
import {
  assertAuthorized,
  type AuthorizationActor,
  type Capability,
} from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { DealStatus, PurchaseType } from "./manage-deal";

export type QuoteStatus = "draft" | "presented" | "accepted" | "rejected" | "expired";
export type QuoteLineCategory = "vehicle" | "product" | "accessory" | "fee" | "tax" | "discount";
export interface QuoteLine { id: string; position: number; category: QuoteLineCategory; description: string; quantity: number; unitAmountCents: number; totalCents: number; }
export interface QuoteRecord extends OrganizationScope { id: string; dealId: string; version: number; status: QuoteStatus; purchaseType: PurchaseType; currency: string; subtotalCents: number; feeCents: number; taxCents: number; discountCents: number; totalCents: number; expiresAt?: string; presentedAt?: string; acceptedAt?: string; idempotencyKey: string; lines: readonly QuoteLine[]; }
export interface QuoteStatusEvent extends OrganizationScope { id: string; quoteId: string; fromStatus?: QuoteStatus; toStatus: QuoteStatus; reason?: string; occurredAt: string; idempotencyKey: string; }
export interface CreateQuoteRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string; idempotencyKey: string; dealId: string; purchaseType: PurchaseType; currency?: string; expiresAt?: string; lines: readonly { category: QuoteLineCategory; description: string; quantity?: number; unitAmountCents: number }[]; }
export interface TransitionQuoteRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string; idempotencyKey: string; quoteId: string; toStatus: Exclude<QuoteStatus, "draft">; reason?: string; }
export interface QuoteSession {
  acquireLock(scope: OrganizationScope, key: string): Promise<void>;
  findQuoteByIdempotency(scope: OrganizationScope, key: string): Promise<QuoteRecord | null>;
  getDealContextForUpdate(scope: OrganizationScope, dealId: string): Promise<{ status: DealStatus; locationId: string } | null>;
  nextVersion(scope: OrganizationScope, dealId: string): Promise<number>;
  createQuote(context: RequestContext, quote: QuoteRecord, event: QuoteStatusEvent): Promise<QuoteRecord>;
  findTransitionByIdempotency(scope: OrganizationScope, key: string): Promise<{ quote: QuoteRecord; event: QuoteStatusEvent } | null>;
  getQuoteForUpdate(scope: OrganizationScope, quoteId: string): Promise<{ quote: QuoteRecord; dealStatus: DealStatus; locationId: string } | null>;
  getApprovalStatus(scope: OrganizationScope, quoteId: string): Promise<"pending" | "approved" | "declined" | null>;
  getApprovalRequirement(
    scope: OrganizationScope,
    quote: Pick<QuoteRecord, "locationId" | "discountCents">,
  ): Promise<{ required: boolean; reason?: "always" | "discount-threshold" }>;
  hasAcceptedQuote(scope: OrganizationScope, dealId: string, exceptQuoteId: string): Promise<boolean>;
  transitionQuote(context: RequestContext, quote: QuoteRecord, event: QuoteStatusEvent): Promise<QuoteRecord>;
}
export interface QuoteProvider { transaction<Result>(operation: (session: QuoteSession) => Promise<Result>): Promise<Result>; }
export class QuoteValidationError extends Error { constructor(readonly issues: readonly string[]) { super("Quote data is invalid."); this.name = "QuoteValidationError"; } }
export class QuoteIntegrityError extends Error { constructor(message: string) { super(message); this.name = "QuoteIntegrityError"; } }
export class QuoteTransitionError extends Error { constructor(readonly from: QuoteStatus, readonly to: QuoteStatus) { super(`Quote cannot transition from ${from} to ${to}.`); this.name = "QuoteTransitionError"; } }

export class QuoteService {
  constructor(private readonly provider: QuoteProvider, private readonly now: () => Date = () => new Date()) {}
  async create(request: CreateQuoteRequest): Promise<{ quote: QuoteRecord; created: boolean }> {
    const calculated = validateAndCalculate(request); authorizeQuoteAction(request.actor, request.organizationId, request.locationId, "quote.create");
    return this.provider.transaction(async (session) => { await session.acquireLock(request, request.idempotencyKey); const existing = await session.findQuoteByIdempotency(request, request.idempotencyKey); if (existing) { authorizeQuoteAction(request.actor, request.organizationId, existing.locationId, "quote.create"); return { quote: existing, created: false }; }
      await session.acquireLock(request, `quote-version:${request.dealId}`); const deal = await session.getDealContextForUpdate(request, request.dealId); if (!deal) throw new QuoteIntegrityError("The deal is unavailable."); authorizeQuoteAction(request.actor, request.organizationId, deal.locationId, "quote.create"); if (["contracted", "delivered", "cancelled"].includes(deal.status)) throw new QuoteIntegrityError("This deal no longer accepts quote versions.");
      if (calculated.expiresAt && new Date(calculated.expiresAt) <= this.now()) throw new QuoteValidationError(["expiresAt must be in the future."]);
      const id = generateEntityId("quo"); const quote: QuoteRecord = { id, organizationId: request.organizationId, locationId: deal.locationId, dealId: request.dealId, version: await session.nextVersion(request, request.dealId), status: "draft", purchaseType: request.purchaseType, currency: calculated.currency, ...calculated.totals, ...(calculated.expiresAt ? { expiresAt: calculated.expiresAt } : {}), idempotencyKey: request.idempotencyKey,
        lines: calculated.lines.map((line, position) => ({ id: generateEntityId("qli"), position, ...line })) };
      const event: QuoteStatusEvent = { id: generateEntityId("qst"), organizationId: request.organizationId, locationId: deal.locationId, quoteId: id, toStatus: "draft", occurredAt: this.now().toISOString(), idempotencyKey: `create:${request.idempotencyKey}` };
      return { quote: await session.createQuote(context(request), quote, event), created: true };
    });
  }
  async transition(request: TransitionQuoteRequest): Promise<{ quote: QuoteRecord; event: QuoteStatusEvent; transitioned: boolean }> {
    validateTransition(request); const requiredCapability = transitionCapability(request.toStatus); authorizeQuoteAction(request.actor, request.organizationId, request.locationId, requiredCapability);
    return this.provider.transaction(async (session) => { await session.acquireLock(request, request.idempotencyKey); const existing = await session.findTransitionByIdempotency(request, request.idempotencyKey); if (existing) { authorizeQuoteAction(request.actor, request.organizationId, existing.quote.locationId, requiredCapability); return { ...existing, transitioned: false }; }
      const resolved = await session.getQuoteForUpdate(request, request.quoteId); if (!resolved) throw new QuoteIntegrityError("The quote is unavailable."); authorizeQuoteAction(request.actor, request.organizationId, resolved.locationId, requiredCapability); await session.acquireLock(request, `quote-decision:${resolved.quote.dealId}`); if (!allowed[resolved.quote.status].includes(request.toStatus)) throw new QuoteTransitionError(resolved.quote.status, request.toStatus);
      if (request.toStatus === "presented") {
        const approval = await session.getApprovalStatus(request, resolved.quote.id);
        const requirement = await session.getApprovalRequirement(request, resolved.quote);
        if (approval === "pending") throw new QuoteIntegrityError("This quote is still awaiting manager approval.");
        if (approval === "declined") throw new QuoteIntegrityError("This quote was declined. Create a revised quote version before issuing.");
        if (requirement.required && approval !== "approved") {
          throw new QuoteIntegrityError(
            requirement.reason === "discount-threshold"
              ? "This quote requires manager approval because its discount meets the configured threshold."
              : "This quote requires manager approval before it can be issued.",
          );
        }
      }
      const current = this.now(); if (request.toStatus === "accepted" && resolved.quote.expiresAt && new Date(resolved.quote.expiresAt) <= current) throw new QuoteIntegrityError("An expired quote cannot be accepted."); if (request.toStatus === "accepted" && await session.hasAcceptedQuote(request, resolved.quote.dealId, resolved.quote.id)) throw new QuoteIntegrityError("This deal already has an accepted quote."); if (["contracted", "delivered", "cancelled"].includes(resolved.dealStatus)) throw new QuoteIntegrityError("The deal no longer accepts quote changes.");
      if ((request.toStatus === "rejected" || request.toStatus === "expired") && !request.reason?.trim()) throw new QuoteValidationError(["reason is required for rejection or expiration."]);
      const quote: QuoteRecord = { ...resolved.quote, status: request.toStatus, ...(request.toStatus === "presented" ? { presentedAt: current.toISOString() } : {}), ...(request.toStatus === "accepted" ? { acceptedAt: current.toISOString() } : {}) };
      const event: QuoteStatusEvent = { id: generateEntityId("qst"), organizationId: request.organizationId, locationId: resolved.locationId, quoteId: quote.id, fromStatus: resolved.quote.status, toStatus: request.toStatus, ...(request.reason?.trim() ? { reason: request.reason.trim() } : {}), occurredAt: current.toISOString(), idempotencyKey: request.idempotencyKey };
      return { quote: await session.transitionQuote(context(request), quote, event), event, transitioned: true };
    });
  }
}

const allowed: Record<QuoteStatus, readonly QuoteStatus[]> = { draft: ["presented", "expired"], presented: ["accepted", "rejected", "expired"], accepted: [], rejected: [], expired: [] };
function validateAndCalculate(request: CreateQuoteRequest) { const issues: string[] = []; const currency = (request.currency ?? "USD").trim().toUpperCase(); if (!request.dealId.trim()) issues.push("dealId is required."); if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required."); if (!/^[A-Z]{3}$/.test(currency)) issues.push("currency must be a three-letter ISO code."); if (!request.lines.length || request.lines.length > 100) issues.push("lines must contain 1 to 100 items."); if (request.lines.filter((line) => line.category === "vehicle").length !== 1) issues.push("Exactly one vehicle line is required."); const lines = request.lines.map((line, index) => { const quantity = line.quantity ?? 1; const description = line.description.trim(); if (!description || description.length > 500) issues.push(`lines[${index}].description is invalid.`); if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) issues.push(`lines[${index}].quantity is invalid.`); if (!Number.isSafeInteger(line.unitAmountCents) || Math.abs(line.unitAmountCents) > 1_000_000_000) issues.push(`lines[${index}].unitAmountCents is invalid.`); if (line.category === "discount" ? line.unitAmountCents > 0 : line.unitAmountCents < 0) issues.push(`lines[${index}] has an invalid amount sign.`); const totalCents = quantity * line.unitAmountCents; if (!Number.isSafeInteger(totalCents)) issues.push(`lines[${index}] total is unsafe.`); return { category: line.category, description, quantity, unitAmountCents: line.unitAmountCents, totalCents }; });
  const expiresAt = request.expiresAt?.trim(); if (expiresAt && Number.isNaN(new Date(expiresAt).valueOf())) issues.push("expiresAt is invalid."); const sum = (categories: readonly QuoteLineCategory[]) => lines.filter((line) => categories.includes(line.category)).reduce((total, line) => total + line.totalCents, 0); const totals = { subtotalCents: sum(["vehicle", "product", "accessory"]), feeCents: sum(["fee"]), taxCents: sum(["tax"]), discountCents: sum(["discount"]) }; const totalCents = totals.subtotalCents + totals.feeCents + totals.taxCents + totals.discountCents; if (!Number.isSafeInteger(totalCents) || totalCents < 0) issues.push("Quote total must be a safe nonnegative integer."); if (issues.length) throw new QuoteValidationError(issues); return { currency, lines, totals: { ...totals, totalCents }, ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) }; }
function validateTransition(request: TransitionQuoteRequest) { const issues: string[] = []; if (!request.quoteId.trim()) issues.push("quoteId is required."); if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required."); if (request.reason && request.reason.trim().length > 1000) issues.push("reason must not exceed 1000 characters."); if (issues.length) throw new QuoteValidationError(issues); }
function authorizeQuoteAction(actor: AuthorizationActor, organizationId: string, locationId: string | undefined, quoteCapability: Capability) { for (const capability of ["deal.read", quoteCapability] as const) assertAuthorized(actor, { capability, organizationId, locationId }); }
function transitionCapability(status: TransitionQuoteRequest["toStatus"]): Capability { return status === "presented" ? "quote.issue" : "quote.revise"; }
function context(request: { actor: AuthorizationActor; organizationId: string; correlationId: string; locationId?: string }): RequestContext { return { actorId: request.actor.userId, organizationId: request.organizationId, correlationId: request.correlationId, ...(request.locationId ? { locationId: request.locationId } : {}) }; }
