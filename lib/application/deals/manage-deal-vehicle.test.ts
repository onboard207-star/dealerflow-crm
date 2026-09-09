import { describe, expect, it } from "vitest";

import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";

import {
  DealVehicleChangeIntegrityError,
  DealVehicleChangeService,
  type DealVehicleChangeEvent,
  type DealVehicleChangeProvider,
  type DealVehicleChangeSession,
} from "./manage-deal-vehicle";

const actor: AuthorizationActor = {
  userId: "usr_manager",
  memberships: [
    {
      organizationId: "org_demo",
      roleKeys: ["sales-manager"],
      capabilities: ["deal.read", "deal.update", "customer.read", "lead.read", "inventory.read"],
      locationIds: ["loc_main"],
    },
  ],
};

class MemoryProvider implements DealVehicleChangeProvider, DealVehicleChangeSession {
  events: DealVehicleChangeEvent[] = [];
  status = "working";
  blockingReason?: string;
  targetIsValid = true;
  concurrentWrite = false;

  async transaction<T>(operation: (session: DealVehicleChangeSession) => Promise<T>) {
    return operation(this);
  }

  async lock() {}

  async findByIdempotency(_scope: { organizationId: string }, key: string) {
    return this.events.find((event) => event.idempotencyKey === key) ?? null;
  }

  async getContext() {
    if (!this.targetIsValid) return null;
    return {
      locationId: "loc_main",
      status: this.status,
      fromVehicleId: "veh_old",
      fromInventoryUnitId: "inv_old",
      ...(this.blockingReason ? { blockingReason: this.blockingReason } : {}),
    };
  }

  async change(_context: RequestContext, event: DealVehicleChangeEvent) {
    if (this.concurrentWrite) {
      throw new DealVehicleChangeIntegrityError("The Deal changed concurrently; no Vehicle replacement was applied.");
    }
    this.events.push({ ...event, invalidatedQuoteIds: ["quo_draft"] });
  }
}

function request() {
  return {
    actor,
    organizationId: "org_demo",
    locationId: "loc_main",
    correlationId: "cor_switch",
    idempotencyKey: "run-two:vehicle-switch",
    dealId: "dea_run_two",
    customerId: "cus_run_two",
    leadId: "led_run_two",
    toVehicleId: "veh_new",
    toInventoryUnitId: "inv_new",
    reason: "Customer selected the alternate vehicle.",
  };
}

describe("DealVehicleChangeService", () => {
  it("changes a pre-approval Deal idempotently and retains invalidated Quote evidence", async () => {
    const provider = new MemoryProvider();
    const service = new DealVehicleChangeService(provider, () => new Date("2026-09-09T20:00:00Z"));
    const first = await service.change(request());
    const replay = await service.change(request());

    expect(first.changed).toBe(true);
    expect(replay.changed).toBe(false);
    expect(first.event).toMatchObject({
      fromVehicleId: "veh_old",
      toVehicleId: "veh_new",
      reason: "Customer selected the alternate vehicle.",
    });
    expect(replay.event.invalidatedQuoteIds).toEqual(["quo_draft"]);
    expect(provider.events).toHaveLength(1);
  });

  it.each(["pending-approval", "approved", "contracted", "delivery-ready", "delivered"])(
    "refuses status %s",
    async (status) => {
      const provider = new MemoryProvider();
      provider.status = status;
      await expect(new DealVehicleChangeService(provider).change(request())).rejects.toBeInstanceOf(
        DealVehicleChangeIntegrityError,
      );
    },
  );

  it.each([
    "Vehicle change is unavailable after Quote approval has begun.",
    "Vehicle change is unavailable after a Quote was presented or accepted.",
    "Vehicle change is unavailable after document work has begun.",
    "Vehicle change is unavailable after delivery work has begun.",
  ])("refuses protected progress: %s", async (reason) => {
    const provider = new MemoryProvider();
    provider.blockingReason = reason;
    await expect(new DealVehicleChangeService(provider).change(request())).rejects.toThrow(reason);
  });

  it("refuses unavailable inventory or a mismatched tenant, location, customer, or lead context", async () => {
    const provider = new MemoryProvider();
    provider.targetIsValid = false;
    await expect(new DealVehicleChangeService(provider).change(request())).rejects.toBeInstanceOf(
      DealVehicleChangeIntegrityError,
    );
  });

  it("fails closed on a stale concurrent Deal update", async () => {
    const provider = new MemoryProvider();
    provider.concurrentWrite = true;
    await expect(new DealVehicleChangeService(provider).change(request())).rejects.toThrow("changed concurrently");
    expect(provider.events).toHaveLength(0);
  });
});
