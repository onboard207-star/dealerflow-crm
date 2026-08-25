import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { OutboundMessagingSession, SendAttempt } from "./outbound-messaging";

export type DeliveryResolution = "sent" | "delivered" | "failed";
export interface ResolveDeliveryUnknownRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string;
  attemptId: string; resolution: DeliveryResolution; providerMessageId?: string; evidenceReference: string; }
export interface UnknownDeliveryProvider {
  transaction<Result>(operation: (session: OutboundMessagingSession) => Promise<Result>): Promise<Result>;
  resolveDeliveryUnknown(context: RequestContext, attempt: SendAttempt, input: {
    resolution: DeliveryResolution; providerMessageId?: string; evidenceReference: string;
  }): Promise<SendAttempt>;
}
export class DeliveryReconciliationError extends Error { constructor(readonly code: "invalid" | "conflict", message: string) { super(message); this.name = "DeliveryReconciliationError"; } }

export class DeliveryReconciliationService {
  constructor(private readonly provider: UnknownDeliveryProvider) {}
  async resolve(request: ResolveDeliveryUnknownRequest): Promise<SendAttempt> {
    if (!request.attemptId.trim() || !request.evidenceReference.trim()) throw new DeliveryReconciliationError("invalid", "Attempt and evidence reference are required.");
    if (request.resolution !== "failed" && !request.providerMessageId?.trim()) throw new DeliveryReconciliationError("invalid", "Provider message ID is required for a successful resolution.");
    const attempt = await this.provider.transaction((session) => session.findAttemptById(request, request.attemptId));
    if (!attempt) throw new DeliveryReconciliationError("conflict", "The send attempt is unavailable.");
    for (const capability of ["organization.configure", "communication.read"] as const) assertAuthorized(request.actor, {
      capability, organizationId: request.organizationId, locationId: attempt.locationId });
    if (attempt.status !== "delivery-unknown") throw new DeliveryReconciliationError("conflict", "Only a delivery-unknown attempt may be resolved.");
    return this.provider.resolveDeliveryUnknown({ actorId: request.actor.userId, organizationId: request.organizationId,
      correlationId: request.correlationId, ...(attempt.locationId ? { locationId: attempt.locationId } : {}) }, attempt,
    { resolution: request.resolution, ...(request.providerMessageId?.trim() ? { providerMessageId: request.providerMessageId.trim() } : {}),
      evidenceReference: request.evidenceReference.trim() });
  }
}
