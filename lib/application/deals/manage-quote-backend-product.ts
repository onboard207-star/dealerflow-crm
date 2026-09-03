import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export interface QuoteBackendProductSnapshot extends OrganizationScope {
  id: string;
  quoteId: string;
  quoteLineId: string;
  productId: string;
  sellCents: number;
  costCents: number;
  grossCents: number;
  capturedAt: string;
}

export interface AttachQuoteBackendProductRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  quoteId: string;
  quoteLineId: string;
  productId: string;
  costCents: number;
}

export interface QuoteBackendProductSession {
  getQuoteLineContext(
    scope: OrganizationScope,
    quoteId: string,
    quoteLineId: string,
  ): Promise<{
    quoteStatus: string;
    locationId: string;
    category: "product" | "accessory" | string;
    lineTotalCents: number;
  } | null>;
  getProduct(
    scope: OrganizationScope,
    productId: string,
  ): Promise<{
    active: boolean;
    locationId?: string;
    quoteLineCategory: "product" | "accessory";
  } | null>;
  snapshotExists(scope: OrganizationScope, quoteLineId: string): Promise<boolean>;
  createSnapshot(
    context: RequestContext,
    snapshot: QuoteBackendProductSnapshot,
  ): Promise<QuoteBackendProductSnapshot>;
}

export interface QuoteBackendProductProvider {
  transaction<Result>(
    operation: (session: QuoteBackendProductSession) => Promise<Result>,
  ): Promise<Result>;
}

export class QuoteBackendProductValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Quote backend product data is invalid.");
    this.name = "QuoteBackendProductValidationError";
  }
}

export class QuoteBackendProductIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteBackendProductIntegrityError";
  }
}

export class QuoteBackendProductService {
  constructor(
    private readonly provider: QuoteBackendProductProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async attach(
    request: AttachQuoteBackendProductRequest,
  ): Promise<QuoteBackendProductSnapshot> {
    validate(request);
    authorizeSensitive(
      request.actor,
      request.organizationId,
      request.locationId,
    );

    return this.provider.transaction(async (session) => {
      const line = await session.getQuoteLineContext(
        request,
        request.quoteId,
        request.quoteLineId,
      );
      if (!line) {
        throw new QuoteBackendProductIntegrityError("The Quote product line is unavailable.");
      }
      authorizeSensitive(request.actor, request.organizationId, line.locationId);
      if (line.quoteStatus !== "draft") {
        throw new QuoteBackendProductIntegrityError(
          "Backend cost may only be attached while the Quote version is draft.",
        );
      }
      if (line.category !== "product" && line.category !== "accessory") {
        throw new QuoteBackendProductIntegrityError(
          "Internal product cost can only attach to a product or accessory Quote line.",
        );
      }
      const product = await session.getProduct(request, request.productId);
      if (!product?.active) {
        throw new QuoteBackendProductIntegrityError("The backend product is unavailable or inactive.");
      }
      if (product.locationId && product.locationId !== line.locationId) {
        throw new QuoteBackendProductIntegrityError(
          "The backend product does not apply to this dealership location.",
        );
      }
      if (product.quoteLineCategory !== line.category) {
        throw new QuoteBackendProductIntegrityError(
          "The backend product type does not match the Quote line category.",
        );
      }
      if (await session.snapshotExists(request, request.quoteLineId)) {
        throw new QuoteBackendProductIntegrityError(
          "This Quote line already has an internal cost snapshot.",
        );
      }

      const snapshot: QuoteBackendProductSnapshot = {
        id: generateEntityId("qbp"),
        organizationId: request.organizationId,
        locationId: line.locationId,
        quoteId: request.quoteId,
        quoteLineId: request.quoteLineId,
        productId: request.productId,
        sellCents: line.lineTotalCents,
        costCents: request.costCents,
        grossCents: line.lineTotalCents - request.costCents,
        capturedAt: this.now().toISOString(),
      };
      return session.createSnapshot(context(request), snapshot);
    });
  }
}

export function calculateBackendGross(
  products: readonly Pick<QuoteBackendProductSnapshot, "sellCents" | "costCents">[],
) {
  return products.reduce(
    (gross, product) => gross + product.sellCents - product.costCents,
    0,
  );
}

function validate(request: AttachQuoteBackendProductRequest) {
  const issues: string[] = [];
  if (!request.quoteId.trim()) issues.push("quoteId is required.");
  if (!request.quoteLineId.trim()) issues.push("quoteLineId is required.");
  if (!request.productId.trim()) issues.push("productId is required.");
  if (!Number.isSafeInteger(request.costCents) || request.costCents < 0) {
    issues.push("costCents must be a nonnegative safe integer.");
  }
  if (issues.length) throw new QuoteBackendProductValidationError(issues);
}

function authorizeSensitive(
  actor: AuthorizationActor,
  organizationId: string,
  locationId: string | undefined,
) {
  assertAuthorized(actor, { capability: "deal.read", organizationId, locationId });
  assertAuthorized(actor, { capability: "quote.revise", organizationId, locationId });
  assertAuthorized(actor, {
    capability: "quote.view_sensitive_terms",
    organizationId,
    locationId,
  });
}

function context(request: {
  actor: AuthorizationActor;
  organizationId: string;
  correlationId: string;
  locationId?: string;
}): RequestContext {
  return {
    actorId: request.actor.userId,
    organizationId: request.organizationId,
    correlationId: request.correlationId,
    ...(request.locationId ? { locationId: request.locationId } : {}),
  };
}
