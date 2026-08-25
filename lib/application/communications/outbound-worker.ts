import type { OutboundMessagingService } from "./outbound-messaging";

export interface DueOutboundAttempt { organizationId: string; attemptId: string; }
export interface DueOutboundDiscovery { listDue(dueBefore: string, limit: number): Promise<readonly DueOutboundAttempt[]>; }
export interface OutboundWorkerResult { discovered: number; accepted: number; rejected: number; deliveryUnknown: number; skipped: number; failed: number; }

export class OutboundWorker {
  constructor(private readonly discovery: DueOutboundDiscovery,
    private readonly serviceForOrganization: (organizationId: string) => OutboundMessagingService,
    private readonly now: () => Date = () => new Date()) {}

  async run(limit = 25): Promise<OutboundWorkerResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("Worker limit must be between 1 and 100.");
    const due = await this.discovery.listDue(this.now().toISOString(), limit);
    const result: OutboundWorkerResult = { discovered: due.length, accepted: 0, rejected: 0,
      deliveryUnknown: 0, skipped: 0, failed: 0 };
    for (const item of due) {
      try {
        const outcome = await this.serviceForOrganization(item.organizationId)
          .dispatchAttempt({ organizationId: item.organizationId }, item.attemptId);
        if (!outcome.dispatched && outcome.attempt.status === "rejected") result.rejected += 1;
        else if (!outcome.dispatched) result.skipped += 1;
        else if (outcome.attempt.status === "accepted") result.accepted += 1;
        else if (outcome.attempt.status === "delivery-unknown") result.deliveryUnknown += 1;
        else result.failed += 1;
      } catch { result.failed += 1; }
    }
    return result;
  }
}
