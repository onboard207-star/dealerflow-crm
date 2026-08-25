import { generateEntityId } from "@/lib/core/identifiers";
import type { OutboundMessageGateway, OutboundMessageReceipt } from "@/lib/integrations/communications";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { CommunicationChannel } from "./record-communication";

export type ConsentPurpose = "operational" | "marketing";
export type ConsentAction = "granted" | "revoked";
export type ConsentBasis = "express-written" | "customer-initiated" | "not-applicable";
export interface ConsentEvent extends OrganizationScope { id: string; customerId: string; channel: CommunicationChannel;
  purpose: ConsentPurpose; address: string; action: ConsentAction; basis: ConsentBasis;
  evidenceReference: string; occurredAt: string; idempotencyKey: string; createdBy: string; }
export interface RecordConsentRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string;
  idempotencyKey: string; customerId: string; channel: CommunicationChannel; purpose: ConsentPurpose;
  address: string; action: ConsentAction; basis: ConsentBasis; evidenceReference: string; occurredAt: string; }
export interface SendAttempt extends OrganizationScope { id: string; customerId: string; leadId?: string;
  integrationId: string; consentEventId: string; destination: string; body: string;
  consentBasis: "express-written" | "customer-initiated";
  consentOccurredAt: string; consentEvidenceReference: string;
  purpose: ConsentPurpose; status: "queued" | "dispatching" | "accepted" | "delivery-unknown" | "rejected";
  notBefore: string; providerMessageId?: string; providerStatus?: string; failureCode?: string; idempotencyKey: string; }
export interface PrepareSendRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string;
  idempotencyKey: string; customerId: string; leadId?: string; integrationId: string;
  destination: string; body: string; purpose: ConsentPurpose; requestedAt: string; }

export interface OutboundMessagingSession {
  acquireIdempotencyLock(scope: OrganizationScope, key: string): Promise<void>;
  findConsentByIdempotency(scope: OrganizationScope, key: string): Promise<ConsentEvent | null>;
  customerAddressMatches(scope: OrganizationScope, customerId: string, channel: CommunicationChannel, address: string): Promise<boolean>;
  createConsent(context: RequestContext, input: Omit<ConsentEvent, "createdBy">): Promise<ConsentEvent>;
  findAttemptByIdempotency(scope: OrganizationScope, key: string): Promise<SendAttempt | null>;
  findAttemptById(scope: OrganizationScope, id: string): Promise<SendAttempt | null>;
  resolveEligibility(scope: OrganizationScope, customerId: string, integrationId: string,
    destination: string, purpose: ConsentPurpose, leadId?: string): Promise<{ consent: ConsentEvent; timezone: string } | null>;
  createAttempt(context: RequestContext, input: Omit<SendAttempt, "status">): Promise<SendAttempt>;
}
export interface OutboundMessagingProvider {
  transaction<Result>(operation: (session: OutboundMessagingSession) => Promise<Result>): Promise<Result>;
  claim(scope: OrganizationScope, attemptId: string, now: string): Promise<SendAttempt | null>;
  markAccepted(scope: OrganizationScope, attemptId: string, receipt: OutboundMessageReceipt): Promise<SendAttempt>;
  markDeliveryUnknown(scope: OrganizationScope, attemptId: string): Promise<SendAttempt>;
  markRejected(scope: OrganizationScope, attemptId: string, failureCode: string): Promise<SendAttempt>;
}
export interface OutboundGatewayResolver { resolve(scope: OrganizationScope, integrationId: string): Promise<OutboundMessageGateway>; }

export class ConsentValidationError extends Error { readonly issues: readonly string[];
  constructor(issues: readonly string[]) { super("Communication consent is invalid."); this.name = "ConsentValidationError"; this.issues = [...issues]; } }
export class OutboundMessagingError extends Error { constructor(readonly code: "consent-required" | "context-invalid", message: string) { super(message); this.name = "OutboundMessagingError"; } }

export class OutboundMessagingService {
  constructor(private readonly provider: OutboundMessagingProvider,
    private readonly gateways: OutboundGatewayResolver, private readonly now: () => Date = () => new Date()) {}

  async recordConsent(request: RecordConsentRequest): Promise<{ consent: ConsentEvent; created: boolean }> {
    validateConsent(request, this.now());
    assertAuthorized(request.actor, { capability: "communication.consent.manage", organizationId: request.organizationId, locationId: request.locationId });
    return this.provider.transaction(async (session) => {
      await session.acquireIdempotencyLock(request, request.idempotencyKey);
      const existing = await session.findConsentByIdempotency(request, request.idempotencyKey);
      if (existing) return { consent: existing, created: false };
      if (!(await session.customerAddressMatches(request, request.customerId, request.channel, request.address))) {
        throw new OutboundMessagingError("context-invalid", "Consent address does not match the customer.");
      }
      const context = requestContext(request);
      const consent = await session.createConsent(context, { id: generateEntityId("cns"), organizationId: request.organizationId,
        ...(request.locationId ? { locationId: request.locationId } : {}), customerId: request.customerId,
        channel: request.channel, purpose: request.purpose, address: request.address,
        action: request.action, basis: request.basis, evidenceReference: request.evidenceReference.trim(),
        occurredAt: request.occurredAt, idempotencyKey: request.idempotencyKey });
      return { consent, created: true };
    });
  }

  async send(request: PrepareSendRequest): Promise<{ attempt: SendAttempt; dispatched: boolean }> {
    validateSend(request);
    for (const capability of ["communication.send", "communication.read", "customer.read", "lead.read"] as const) {
      assertAuthorized(request.actor, { capability, organizationId: request.organizationId, locationId: request.locationId });
    }
    const prepared = await this.provider.transaction(async (session) => {
      await session.acquireIdempotencyLock(request, request.idempotencyKey);
      const existing = await session.findAttemptByIdempotency(request, request.idempotencyKey);
      if (existing) return existing;
      const eligibility = await session.resolveEligibility(request, request.customerId, request.integrationId,
        request.destination, request.purpose, request.leadId);
      if (!eligibility || eligibility.consent.action !== "granted") {
        throw new OutboundMessagingError("consent-required", "Current consent is required for this destination and purpose.");
      }
      const notBefore = nextAllowedInstant(new Date(request.requestedAt), eligibility.timezone);
      return session.createAttempt(requestContext(request), { id: generateEntityId("snd"), organizationId: request.organizationId,
        ...(request.locationId ? { locationId: request.locationId } : {}), customerId: request.customerId,
        ...(request.leadId ? { leadId: request.leadId } : {}), integrationId: request.integrationId,
        consentEventId: eligibility.consent.id, destination: request.destination, body: request.body.trim(),
        consentBasis: eligibility.consent.basis as "express-written" | "customer-initiated",
        consentOccurredAt: eligibility.consent.occurredAt,
        consentEvidenceReference: eligibility.consent.evidenceReference,
        purpose: request.purpose, notBefore: notBefore.toISOString(), idempotencyKey: request.idempotencyKey });
    });
    return this.dispatchAttempt(request, prepared.id);
  }

  async dispatchAttempt(scope: OrganizationScope, attemptId: string): Promise<{ attempt: SendAttempt; dispatched: boolean }> {
    const prepared = await this.provider.transaction((session) => session.findAttemptById(scope, attemptId));
    if (!prepared) throw new OutboundMessagingError("context-invalid", "The send attempt is unavailable.");
    if (prepared.status !== "queued") return { attempt: prepared, dispatched: false };
    const eligibility = await this.provider.transaction((session) => session.resolveEligibility(scope, prepared.customerId,
      prepared.integrationId, prepared.destination, prepared.purpose, prepared.leadId));
    if (!eligibility || eligibility.consent.action !== "granted") {
      return { attempt: await this.provider.markRejected(scope, prepared.id, "consent_not_current"), dispatched: false };
    }
    const current = this.now();
    if (new Date(prepared.notBefore) > current) return { attempt: prepared, dispatched: false };
    const claimed = await this.provider.claim(scope, prepared.id, current.toISOString());
    if (!claimed) return { attempt: prepared, dispatched: false };
    try {
      const gateway = await this.gateways.resolve(scope, prepared.integrationId);
      const receipt = await gateway.send({ to: prepared.destination, body: prepared.body,
        idempotencyKey: prepared.idempotencyKey, consent: { basis: prepared.consentBasis,
          capturedAt: prepared.consentOccurredAt, evidenceReference: prepared.consentEvidenceReference } });
      return { attempt: await this.provider.markAccepted(scope, prepared.id, receipt), dispatched: true };
    } catch {
      return { attempt: await this.provider.markDeliveryUnknown(scope, prepared.id), dispatched: true };
    }
  }
}

function validateConsent(request: RecordConsentRequest, now: Date) { const issues: string[] = [];
  if (!request.locationId?.trim()) issues.push("locationId is required.");
  if (!request.customerId.trim()) issues.push("customerId is required.");
  if (!request.evidenceReference.trim()) issues.push("evidenceReference is required.");
  if (request.evidenceReference.trim().length > 500) issues.push("evidenceReference must not exceed 500 characters.");
  if (request.action === "revoked" ? request.basis !== "not-applicable" : request.basis === "not-applicable") issues.push("basis does not match the consent action.");
  const occurredAt = new Date(request.occurredAt); if (Number.isNaN(occurredAt.valueOf())) issues.push("occurredAt is invalid.");
  else if (occurredAt.getTime() > now.getTime() + 5 * 60_000) issues.push("occurredAt cannot be in the future.");
  if (request.channel === "sms" && !/^\+[1-9]\d{7,14}$/.test(request.address)) issues.push("SMS address must use E.164 format.");
  if (issues.length) throw new ConsentValidationError(issues); }
function validateSend(request: PrepareSendRequest) { const issues: string[] = [];
  if (!request.locationId?.trim()) issues.push("locationId is required.");
  if (!/^\+[1-9]\d{7,14}$/.test(request.destination)) issues.push("destination must use E.164 format.");
  if (!request.body.trim() || request.body.length > 1600) issues.push("body must contain 1 to 1600 characters.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (Number.isNaN(new Date(request.requestedAt).valueOf())) issues.push("requestedAt is invalid.");
  if (issues.length) throw new ConsentValidationError(issues); }
function requestContext(request: { actor: AuthorizationActor; organizationId: string; locationId?: string; correlationId: string }): RequestContext {
  return { actorId: request.actor.userId, organizationId: request.organizationId, correlationId: request.correlationId,
    ...(request.locationId ? { locationId: request.locationId } : {}) }; }
export function nextAllowedInstant(requestedAt: Date, timezone: string): Date {
  if (Number.isNaN(requestedAt.valueOf())) throw new ConsentValidationError(["requestedAt is invalid."]);
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(requestedAt); } catch { throw new ConsentValidationError(["Location timezone is invalid."]); }
  const candidate = new Date(requestedAt);
  for (let minutes = 0; minutes <= 24 * 60; minutes += 1) {
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone: timezone }).format(candidate));
    if (hour >= 8 && hour < 20) return candidate;
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1, 0, 0);
  }
  throw new ConsentValidationError(["Unable to resolve quiet hours."]);
}
