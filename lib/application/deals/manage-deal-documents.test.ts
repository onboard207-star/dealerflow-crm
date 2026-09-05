import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import { DealDocumentIntegrityError, DealDocumentService, DealDocumentValidationError, type DealDocumentEvent, type DealDocumentProvider, type DealDocumentRequirement, type DealDocumentSession, type DealDocumentStatus } from "./manage-deal-documents";

const organizationId = "org_dealerflow";
const locationId = "loc_main";
const actor = (capabilities: AuthorizationActor["memberships"][number]["capabilities"] = ["document.read", "document.manage", "document.complete", "document.waive"], locations: readonly string[] | "all" = [locationId]): AuthorizationActor => ({ userId: "usr_finance", memberships: [{ organizationId, locationIds: locations, capabilities }] });

class MemoryProvider implements DealDocumentProvider {
  records: DealDocumentRequirement[] = [];
  events: DealDocumentEvent[] = [];
  context: { locationId: string; quoteId: string; quoteVersion: number } | null = { locationId, quoteId: "quo_accepted", quoteVersion: 3 };
  async list(_scope: { organizationId: string }, dealId: string) { return this.records.filter((record) => record.dealId === dealId); }
  async transaction<Result>(operation: (session: DealDocumentSession) => Promise<Result>) {
    return operation({
      acquireLock: async () => {},
      findByIdempotency: async (scope, key) => this.records.find((record) => record.organizationId === scope.organizationId && this.events.some((event) => event.requirementId === record.id && event.idempotencyKey === key)) ?? null,
      getContractContext: async () => this.context,
      nextVersion: async (_scope, dealId, type) => this.records.filter((record) => record.dealId === dealId && record.documentType === type).length + 1,
      create: async (_context, item, event) => { this.records.push(item); this.events.push(event); return item; },
      findTransition: async (_scope, key) => { const event = this.events.find((item) => item.idempotencyKey === key && item.fromStatus); const requirement = event && this.records.find((item) => item.id === event.requirementId); return event && requirement ? { requirement, event } : null; },
      getForUpdate: async (_scope, dealId, id) => this.records.find((record) => record.dealId === dealId && record.id === id) ?? null,
      transition: async (_context, item, event) => { this.records = this.records.map((record) => record.id === item.id ? item : record); this.events.push(event); return item; },
    });
  }
}

const create = (service: DealDocumentService, key = "create:purchase") => service.create({ actor: actor(), organizationId, correlationId: "req_test", idempotencyKey: key, dealId: "dea_contract", documentType: "purchase-agreement", sourceType: "uploaded", required: true, waiverAllowed: false });
const transition = (service: DealDocumentService, requirementId: string, toStatus: Exclude<DealDocumentStatus, "pending">, key: string, reason?: string) => service.transition({ actor: actor(), organizationId, correlationId: "req_test", idempotencyKey: key, dealId: "dea_contract", requirementId, toStatus, ...(reason ? { reason } : {}) });

describe("DealDocumentService", () => {
  it("binds requirements to the exact accepted Quote and is idempotent", async () => {
    const provider = new MemoryProvider(); const service = new DealDocumentService(provider, () => new Date("2026-09-04T12:00:00Z"));
    const first = await create(service); const second = await create(service);
    expect(first.created).toBe(true); expect(second.created).toBe(false);
    expect(first.requirement).toMatchObject({ quoteId: "quo_accepted", quoteVersion: 3, status: "pending", locationId });
    expect(provider.records).toHaveLength(1);
  });

  it("rejects missing contract context and location attacks", async () => {
    const provider = new MemoryProvider(); provider.context = null;
    await expect(create(new DealDocumentService(provider))).rejects.toBeInstanceOf(DealDocumentIntegrityError);
    provider.context = { locationId, quoteId: "quo_accepted", quoteVersion: 3 };
    await expect(new DealDocumentService(provider).create({ actor: actor(undefined, ["loc_other"]), organizationId, correlationId: "req", idempotencyKey: "key", dealId: "dea_contract", documentType: "purchase-agreement", sourceType: "uploaded", required: true, waiverAllowed: false })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("requires evidence before completion and explicit policy for waivers", async () => {
    const provider = new MemoryProvider(); const service = new DealDocumentService(provider); const created = (await create(service)).requirement;
    await expect(transition(service, created.id, "complete", "complete:1")).rejects.toBeInstanceOf(DealDocumentIntegrityError);
    await expect(transition(service, created.id, "waived", "waive:1", "Approved exception")).rejects.toBeInstanceOf(DealDocumentValidationError);
    await transition(service, created.id, "provided", "provided:1");
    const completed = await transition(service, created.id, "complete", "complete:2");
    expect(completed.requirement.completedBy).toBe("usr_finance");
    expect((await transition(service, created.id, "complete", "complete:2")).transitioned).toBe(false);
  });

  it("enforces distinct authority and Deal ownership", async () => {
    const provider = new MemoryProvider(); const service = new DealDocumentService(provider); const created = (await create(service)).requirement;
    await expect(service.list({ actor: actor([]), organizationId, dealId: "dea_contract" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(service.create({ actor: actor(["document.read"]), organizationId, correlationId: "req", idempotencyKey: "create:2", dealId: "dea_contract", documentType: "contract", sourceType: "uploaded", required: true, waiverAllowed: false })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(service.transition({ actor: actor(), organizationId, correlationId: "req", idempotencyKey: "wrong-deal", dealId: "dea_other", requirementId: created.id, toStatus: "provided" })).rejects.toBeInstanceOf(DealDocumentIntegrityError);
  });

  it("rejects direct URLs as ungoverned document references", async () => {
    await expect(new DealDocumentService(new MemoryProvider()).create({ actor: actor(), organizationId, correlationId: "req", idempotencyKey: "create:url", dealId: "dea_contract", documentType: "contract", sourceType: "external-reference", externalReference: "https://example.com/private.pdf", required: true, waiverAllowed: false })).rejects.toBeInstanceOf(DealDocumentValidationError);
  });
});
