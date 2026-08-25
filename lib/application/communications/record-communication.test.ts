import { describe, expect, it } from "vitest";

import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  CommunicationIntegrityError, CommunicationValidationError, RecordCommunicationService,
  type CommunicationProvider, type CommunicationRecord, type CommunicationSession,
  type CreateCommunicationInput, type RecordCommunicationRequest,
} from "./record-communication";

class MemoryProvider implements CommunicationProvider, CommunicationSession {
  records: CommunicationRecord[] = []; targetAvailable = true; locks: string[] = [];
  async transaction<Result>(operation: (session: CommunicationSession) => Promise<Result>) { return operation(this); }
  async acquireIdempotencyLock(_scope: { organizationId: string }, key: string) { this.locks.push(key); }
  async targetExists() { return this.targetAvailable; }
  async findByIdempotencyKey(scope: { organizationId: string }, key: string) {
    return this.records.find((item) => item.organizationId === scope.organizationId && item.idempotencyKey === key) ?? null;
  }
  async create(context: RequestContext, input: CreateCommunicationInput) {
    const record: CommunicationRecord = { ...input, createdAt: "2026-08-23T12:00:00.000Z", createdBy: context.actorId };
    this.records.push(record); return record;
  }
}

const capabilities: AuthorizationActor["memberships"][number]["capabilities"] = [
  "communication.read", "communication.create", "customer.read", "lead.read",
];
function request(overrides: Partial<RecordCommunicationRequest> = {}): RecordCommunicationRequest {
  return { actor: { userId: "usr_sales", memberships: [{ organizationId: "org_dealerflow", locationIds: ["loc_main"], capabilities }] },
    organizationId: "org_dealerflow", locationId: "loc_main", correlationId: "req_1",
    idempotencyKey: "twilio:message-1", customerId: "cus_jordan", leadId: "led_jordan",
    channel: "sms", direction: "outbound", status: "delivered",
    occurredAt: "2026-08-23T12:00:00.000Z", summary: "Confirmed Tuesday test drive.", ...overrides };
}

describe("RecordCommunicationService", () => {
  it("records a verified communication outcome", async () => {
    const provider = new MemoryProvider(); const result = await new RecordCommunicationService(provider).record(request());
    expect(result.created).toBe(true); expect(result.communication.channel).toBe("sms");
    expect(provider.locks).toEqual(["twilio:message-1"]);
  });
  it("returns the existing event for an idempotent retry", async () => {
    const provider = new MemoryProvider(); const service = new RecordCommunicationService(provider);
    const first = await service.record(request()); const second = await service.record(request());
    expect(second.created).toBe(false); expect(second.communication.id).toBe(first.communication.id);
    expect(provider.records).toHaveLength(1);
  });
  it("rejects unavailable customer or lead context", async () => {
    const provider = new MemoryProvider(); provider.targetAvailable = false;
    await expect(new RecordCommunicationService(provider).record(request())).rejects.toBeInstanceOf(CommunicationIntegrityError);
  });
  it("validates timestamps and bounded summaries", async () => {
    await expect(new RecordCommunicationService(new MemoryProvider()).record(request({ occurredAt: "later", summary: " " })))
      .rejects.toSatisfy((error: unknown) => error instanceof CommunicationValidationError && error.issues.length === 2);
  });
  it("rejects impossible direction outcomes and future evidence",async()=>{const service=new RecordCommunicationService(new MemoryProvider());await expect(service.record(request({direction:"inbound",status:"sent"}))).rejects.toBeInstanceOf(CommunicationValidationError);await expect(service.record(request({direction:"outbound",status:"received"}))).rejects.toBeInstanceOf(CommunicationValidationError);await expect(service.record(request({occurredAt:new Date(Date.now()+10*60_000).toISOString()}))).rejects.toBeInstanceOf(CommunicationValidationError);});
});
