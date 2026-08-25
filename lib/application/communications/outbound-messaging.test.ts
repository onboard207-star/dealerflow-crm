import { describe, expect, it } from "vitest";

import type { OutboundMessageGateway } from "@/lib/integrations/communications";
import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  ConsentValidationError, OutboundMessagingError, OutboundMessagingService, nextAllowedInstant,
  type ConsentEvent, type OutboundMessagingProvider, type OutboundMessagingSession,
  type PrepareSendRequest, type RecordConsentRequest, type SendAttempt,
} from "./outbound-messaging";

class MemoryProvider implements OutboundMessagingProvider, OutboundMessagingSession {
  consents: ConsentEvent[] = []; attempts: SendAttempt[] = []; matches = true; timezone = "America/New_York";
  async transaction<Result>(operation: (session: OutboundMessagingSession) => Promise<Result>) { return operation(this); }
  async acquireIdempotencyLock() {}
  async findConsentByIdempotency(scope: { organizationId: string }, key: string) { return this.consents.find((item) => item.organizationId === scope.organizationId && item.idempotencyKey === key) ?? null; }
  async customerAddressMatches() { return this.matches; }
  async createConsent(context: RequestContext, input: Omit<ConsentEvent, "createdBy">) { const item = { ...input, createdBy: context.actorId }; this.consents.push(item); return item; }
  async findAttemptByIdempotency(scope: { organizationId: string }, key: string) { return this.attempts.find((item) => item.organizationId === scope.organizationId && item.idempotencyKey === key) ?? null; }
  async findAttemptById(scope: { organizationId: string }, id: string) { return this.attempts.find((item) => item.organizationId === scope.organizationId && item.id === id) ?? null; }
  async resolveEligibility(scope: { organizationId: string }, customerId: string, _integrationId: string, destination: string, purpose: "operational" | "marketing") {
    const consent = [...this.consents].reverse().find((item) => item.organizationId === scope.organizationId && item.customerId === customerId && item.address === destination && item.purpose === purpose);
    return consent ? { consent, timezone: this.timezone } : null;
  }
  async createAttempt(_context: RequestContext, input: Omit<SendAttempt, "status">) { const item: SendAttempt = { ...input, status: "queued" }; this.attempts.push(item); return item; }
  async claim(_scope: { organizationId: string }, id: string) { const item = this.attempts.find((candidate) => candidate.id === id); if (!item || item.status !== "queued") return null; item.status = "dispatching"; return item; }
  async markAccepted(_scope: { organizationId: string }, id: string, receipt: { providerMessageId: string; providerStatus: string }) { const item = this.attempts.find((candidate) => candidate.id === id)!; item.status = "accepted"; item.providerMessageId = receipt.providerMessageId; item.providerStatus = receipt.providerStatus; return item; }
  async markDeliveryUnknown(_scope: { organizationId: string }, id: string) { const item = this.attempts.find((candidate) => candidate.id === id)!; item.status = "delivery-unknown"; return item; }
  async markRejected(_scope: { organizationId: string }, id: string, failureCode: string) { const item = this.attempts.find((candidate) => candidate.id === id)!; item.status = "rejected"; item.failureCode = failureCode; return item; }
}

const actor: AuthorizationActor = { userId: "usr_sales", memberships: [{ organizationId: "org_dealerflow", locationIds: ["loc_main"], capabilities: ["communication.consent.manage", "communication.send", "communication.read", "customer.read", "lead.read"] }] };
const consentRequest = (overrides: Partial<RecordConsentRequest> = {}): RecordConsentRequest => ({ actor, organizationId: "org_dealerflow", locationId: "loc_main", correlationId: "req_1", idempotencyKey: "consent-1", customerId: "cus_jordan", channel: "sms", purpose: "operational", address: "+12075550184", action: "granted", basis: "express-written", evidenceReference: "signed-form-1", occurredAt: "2026-08-23T12:00:00.000Z", ...overrides });
const sendRequest = (overrides: Partial<PrepareSendRequest> = {}): PrepareSendRequest => ({ actor, organizationId: "org_dealerflow", locationId: "loc_main", correlationId: "req_2", idempotencyKey: "send-1", customerId: "cus_jordan", integrationId: "int_twilio", destination: "+12075550184", body: "Your test drive is confirmed.", purpose: "operational", requestedAt: "2026-08-23T16:00:00.000Z", ...overrides });

describe("OutboundMessagingService", () => {
  it("records immutable, idempotent consent evidence", async () => { const provider = new MemoryProvider(); const service = new OutboundMessagingService(provider, { resolve: async () => gateway() }); const first = await service.recordConsent(consentRequest()); const second = await service.recordConsent(consentRequest()); expect(first.created).toBe(true); expect(second.created).toBe(false); expect(provider.consents).toHaveLength(1); });
  it("rejects invalid consent basis and a mismatched customer address", async () => { const provider = new MemoryProvider(); const service = new OutboundMessagingService(provider, { resolve: async () => gateway() }); await expect(service.recordConsent(consentRequest({ action: "revoked", basis: "express-written" }))).rejects.toBeInstanceOf(ConsentValidationError); provider.matches = false; await expect(service.recordConsent(consentRequest())).rejects.toBeInstanceOf(OutboundMessagingError); });
  it("dispatches a consented message once and preserves evidence", async () => { const provider = new MemoryProvider(); const sent: unknown[] = []; const service = new OutboundMessagingService(provider, { resolve: async () => gateway(sent) }, () => new Date("2026-08-23T16:00:00.000Z")); await service.recordConsent(consentRequest()); const first = await service.send(sendRequest()); const second = await service.send(sendRequest()); expect(first.attempt.status).toBe("accepted"); expect(first.attempt.consentEvidenceReference).toBe("signed-form-1"); expect(second.dispatched).toBe(false); expect(sent).toHaveLength(1); });
  it("blocks sending after the latest consent event revokes permission", async () => { const provider = new MemoryProvider(); const service = new OutboundMessagingService(provider, { resolve: async () => gateway() }); await service.recordConsent(consentRequest()); await service.recordConsent(consentRequest({ idempotencyKey: "consent-2", action: "revoked", basis: "not-applicable", occurredAt: "2026-08-23T13:00:00.000Z" })); await expect(service.send(sendRequest())).rejects.toMatchObject({ code: "consent-required" }); });
  it("queues during local quiet hours without contacting the gateway", async () => { const provider = new MemoryProvider(); let resolved = false; const service = new OutboundMessagingService(provider, { resolve: async () => { resolved = true; return gateway(); } }, () => new Date("2026-08-23T04:00:00.000Z")); await service.recordConsent(consentRequest({ occurredAt: "2026-08-23T03:00:00.000Z" })); const result = await service.send(sendRequest({ requestedAt: "2026-08-23T04:00:00.000Z" })); expect(result.attempt.status).toBe("queued"); expect(result.attempt.notBefore).toBe("2026-08-23T12:00:00.000Z"); expect(resolved).toBe(false); });
  it("marks an ambiguous provider failure without retrying automatically", async () => { const provider = new MemoryProvider(); const service = new OutboundMessagingService(provider, { resolve: async () => ({ send: async () => { throw new Error("network result unknown"); } }) }, () => new Date("2026-08-23T16:00:00.000Z")); await service.recordConsent(consentRequest()); const result = await service.send(sendRequest()); expect(result.attempt.status).toBe("delivery-unknown"); });
  it("revalidates consent before a deferred attempt dispatches", async () => { const provider = new MemoryProvider(); let now = new Date("2026-08-23T04:00:00.000Z"); const service = new OutboundMessagingService(provider, { resolve: async () => gateway() }, () => now); await service.recordConsent(consentRequest({ occurredAt: "2026-08-23T03:00:00.000Z" })); const queued = await service.send(sendRequest({ requestedAt: now.toISOString() })); now = new Date("2026-08-23T16:00:00.000Z"); await service.recordConsent(consentRequest({ idempotencyKey: "revoke-before-send", action: "revoked", basis: "not-applicable", occurredAt: "2026-08-23T13:00:00.000Z" })); const result = await service.dispatchAttempt(sendRequest(), queued.attempt.id); expect(result.attempt).toMatchObject({ status: "rejected", failureCode: "consent_not_current" }); expect(result.dispatched).toBe(false); });
  it("requires an authorized dealership location for consent and sends", async () => { const provider = new MemoryProvider(); const service = new OutboundMessagingService(provider, { resolve: async () => gateway() }); const consent = consentRequest(); delete consent.locationId; const send = sendRequest(); delete send.locationId; await expect(service.recordConsent(consent)).rejects.toBeInstanceOf(ConsentValidationError); await expect(service.send(send)).rejects.toBeInstanceOf(ConsentValidationError); });
});

describe("nextAllowedInstant", () => { it("returns daytime instants unchanged", () => { expect(nextAllowedInstant(new Date("2026-08-23T16:00:00.000Z"), "America/New_York").toISOString()).toBe("2026-08-23T16:00:00.000Z"); }); });

function gateway(sent: unknown[] = []): OutboundMessageGateway { return { send: async (request) => { sent.push(request); return { provider: "twilio", providerMessageId: "SM123", providerStatus: "queued", acceptedAt: "2026-08-23T16:00:00.000Z" }; } }; }
