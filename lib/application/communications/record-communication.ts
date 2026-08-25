import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export type CommunicationChannel = "call" | "sms" | "email";
export type CommunicationDirection = "inbound" | "outbound";
export type CommunicationStatus = "attempted" | "sent" | "delivered" | "received" | "failed";

export interface CommunicationRecord extends OrganizationScope {
  id: string; customerId: string; leadId?: string; actorUserId?: string;
  channel: CommunicationChannel; direction: CommunicationDirection;
  status: CommunicationStatus; occurredAt: string; summary: string;
  externalMessageId?: string; idempotencyKey: string;
  createdAt: string; createdBy: string;
}

export interface CreateCommunicationInput extends OrganizationScope {
  id: string; customerId: string; leadId?: string; actorUserId?: string;
  channel: CommunicationChannel; direction: CommunicationDirection;
  status: CommunicationStatus; occurredAt: string; summary: string;
  externalMessageId?: string; idempotencyKey: string;
}

export interface CommunicationSession {
  acquireIdempotencyLock(scope: OrganizationScope, key: string): Promise<void>;
  targetExists(scope: OrganizationScope, customerId: string, leadId?: string): Promise<boolean>;
  findByIdempotencyKey(scope: OrganizationScope, key: string): Promise<CommunicationRecord | null>;
  create(context: RequestContext, input: CreateCommunicationInput): Promise<CommunicationRecord>;
}

export interface CommunicationProvider {
  transaction<Result>(operation: (session: CommunicationSession) => Promise<Result>): Promise<Result>;
}

export interface RecordCommunicationRequest extends OrganizationScope {
  actor: AuthorizationActor; correlationId: string; idempotencyKey: string;
  customerId: string; leadId?: string; channel: CommunicationChannel;
  direction: CommunicationDirection; status: CommunicationStatus;
  occurredAt: string; summary: string; externalMessageId?: string;
}

export class CommunicationValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) { super("Communication data is invalid."); this.name = "CommunicationValidationError"; this.issues = [...issues]; }
}

export class CommunicationIntegrityError extends Error {
  constructor(message: string) { super(message); this.name = "CommunicationIntegrityError"; }
}

export class RecordCommunicationService {
  constructor(private readonly provider: CommunicationProvider) {}

  async record(request: RecordCommunicationRequest): Promise<{ communication: CommunicationRecord; created: boolean }> {
    const input = validate(request);
    for (const capability of ["communication.read", "communication.create", "customer.read", "lead.read"] as const) {
      assertAuthorized(request.actor, { capability, organizationId: request.organizationId, locationId: request.locationId });
    }
    return this.provider.transaction(async (session) => {
      await session.acquireIdempotencyLock(request, input.idempotencyKey);
      const existing = await session.findByIdempotencyKey(request, input.idempotencyKey);
      if (existing) return { communication: existing, created: false };
      if (!(await session.targetExists(request, input.customerId, input.leadId))) {
        throw new CommunicationIntegrityError("Customer or lead context is unavailable.");
      }
      const context: RequestContext = { actorId: request.actor.userId,
        organizationId: input.organizationId, correlationId: input.correlationId,
        ...(input.locationId ? { locationId: input.locationId } : {}) };
      const communication = await session.create(context, {
        id: generateEntityId("com"), organizationId: input.organizationId,
        ...(input.locationId ? { locationId: input.locationId } : {}),
        customerId: input.customerId, ...(input.leadId ? { leadId: input.leadId } : {}),
        actorUserId: request.actor.userId, channel: input.channel,
        direction: input.direction, status: input.status, occurredAt: input.occurredAt,
        summary: input.summary, ...(input.externalMessageId ? { externalMessageId: input.externalMessageId } : {}),
        idempotencyKey: input.idempotencyKey,
      });
      return { communication, created: true };
    });
  }
}

function validate(request: RecordCommunicationRequest): RecordCommunicationRequest {
  const issues: string[] = [];
  if (!request.customerId.trim()) issues.push("customerId is required.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (!request.correlationId.trim()) issues.push("correlationId is required.");
  const summary = request.summary.trim();
  if (!summary || summary.length > 1000) issues.push("summary must contain 1 to 1000 characters.");
  const occurredAt=new Date(request.occurredAt);
  if (Number.isNaN(occurredAt.valueOf())) issues.push("occurredAt must be a valid ISO timestamp.");
  else if(occurredAt.valueOf()>Date.now()+5*60_000)issues.push("occurredAt cannot be in the future.");
  if(request.direction==="inbound"&&request.status!=="received"&&request.status!=="failed")issues.push("Inbound communication status must be received or failed.");
  if(request.direction==="outbound"&&request.status==="received")issues.push("Outbound communication cannot use received status.");
  if (issues.length) throw new CommunicationValidationError(issues);
  return { ...request, summary };
}
