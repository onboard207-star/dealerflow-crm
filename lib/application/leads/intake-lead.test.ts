import { describe, expect, it } from "vitest";

import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type {
  AppointmentRecord,
  CreateAppointmentInput,
  CreateCustomerInput,
  CreateLeadInput,
  CreateTaskInput,
  CustomerIdentityQuery,
  CustomerQuery,
  CustomerRecord,
  LeadQuery,
  LeadRecord,
  OrganizationScope,
  PageResult,
  RequestContext,
  TaskRecord,
} from "@/lib/platform/data";

import {
  LeadIntakeService,
  LeadIntakeValidationError,
  type InboundVehicleInterest,
  type LeadIntakeProvider,
  type LeadIntakeRecord,
  type LeadIntakeSession,
  type LeadIntakeRequest,
  type VehicleResolution,
} from "./intake-lead";

const organizationId = "org_dealerflow";
const locationId = "loc_main";
const now = "2026-08-23T12:00:00.000Z";

function createActor(
  capabilities: AuthorizationActor["memberships"][number]["capabilities"] = [
    "lead.create",
    "lead.read",
    "customer.read",
    "customer.create",
    "task.create",
    "inventory.read",
    "appointment.create",
  ],
): AuthorizationActor {
  return {
    userId: "usr_salesperson",
    memberships: [{ organizationId, locationIds: [locationId], capabilities }],
  };
}

function createRequest(overrides: Partial<LeadIntakeRequest> = {}): LeadIntakeRequest {
  return {
    organizationId,
    locationId,
    actor: createActor(),
    correlationId: "req_123",
    idempotencyKey: "website-form:submission-123",
    source: "Dealer Website",
    sourceDetail: "2026 CR-V Hybrid landing page",
    assignedUserId: "usr_salesperson",
    customer: {
      displayName: "Jordan Lee",
      firstName: "Jordan",
      lastName: "Lee",
      email: " Jordan.Lee@Example.com ",
      phone: "+1 (207) 555-0184",
    },
    ...overrides,
  };
}

class MemoryCRMProvider implements LeadIntakeProvider, LeadIntakeSession {
  readonly customers: CustomerRecord[] = [];
  readonly leads: LeadRecord[] = [];
  readonly tasks: TaskRecord[] = [];
  readonly appointments: AppointmentRecord[] = [];
  readonly intakes: LeadIntakeRecord[] = [];
  readonly intakeSources: Array<{ intakeId: string; source: string; sourceLeadId?: string }> = [];
  readonly vehicleInterests: Array<{ leadId: string; vehicleId: string }> = [];
  vehicleResolution: VehicleResolution = { label: "Unresolved vehicle interest", resolved: false };
  transactionCount = 0;
  customerWrites = 0;
  leadWrites = 0;

  async acquireIdempotencyLock() {}

  async transaction<Result>(
    operation: (session: LeadIntakeSession) => Promise<Result>,
  ): Promise<Result> {
    this.transactionCount += 1;
    return operation(this);
  }

  async getCustomer(scope: OrganizationScope, customerId: string) {
    return (
      this.customers.find(
        (customer) =>
          customer.organizationId === scope.organizationId &&
          customer.id === customerId,
      ) ?? null
    );
  }

  async listCustomers(query: CustomerQuery): Promise<PageResult<CustomerRecord>> {
    return {
      records: this.customers
        .filter((record) => record.organizationId === query.organizationId)
        .slice(0, query.limit),
    };
  }

  async findCustomerByIdentity(query: CustomerIdentityQuery) {
    return (
      this.customers.find(
        (customer) =>
          customer.organizationId === query.organizationId &&
          ((query.normalizedEmail && customer.email === query.normalizedEmail) ||
            (query.normalizedPhone && customer.phone === query.normalizedPhone)),
      ) ?? null
    );
  }

  async createCustomer(context: RequestContext, input: CreateCustomerInput) {
    this.customerWrites += 1;
    const customer: CustomerRecord = {
      ...input,
      email: input.normalizedEmail,
      phone: input.normalizedPhone,
      status: "active",
      createdAt: now,
      createdBy: context.actorId,
      updatedAt: now,
      updatedBy: context.actorId,
    };
    this.customers.push(customer);
    return customer;
  }

  async getLead(scope: OrganizationScope, leadId: string) {
    return (
      this.leads.find(
        (lead) => lead.organizationId === scope.organizationId && lead.id === leadId,
      ) ?? null
    );
  }

  async listLeads(query: LeadQuery): Promise<PageResult<LeadRecord>> {
    return {
      records: this.leads
        .filter((record) => record.organizationId === query.organizationId)
        .slice(0, query.limit),
    };
  }

  async findLeadByIdempotencyKey(
    scope: OrganizationScope,
    idempotencyKey: string,
  ) {
    return (
      this.leads.find(
        (lead) =>
          lead.organizationId === scope.organizationId &&
          lead.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async createLead(context: RequestContext, input: CreateLeadInput) {
    this.leadWrites += 1;
    const lead: LeadRecord = {
      ...input,
      status: "open",
      createdAt: now,
      createdBy: context.actorId,
      updatedAt: now,
      updatedBy: context.actorId,
    };
    this.leads.push(lead);
    return lead;
  }

  async findIntake(scope: OrganizationScope, input: { idempotencyKey: string; source: string; sourceLeadId?: string }) {
    const sourceMatch = input.sourceLeadId
      ? this.intakeSources.find((item) => item.source.toLowerCase() === input.source.toLowerCase() && item.sourceLeadId === input.sourceLeadId)
      : undefined;
    const intake = this.intakes.find((record) => record.idempotencyKey === input.idempotencyKey || record.id === sourceMatch?.intakeId);
    if (!intake) return null;
    return { leadId: intake.leadId, customerId: intake.customerId, taskId: intake.followUpTaskId,
      ...(intake.appointmentId ? { appointmentId: intake.appointmentId } : {}), intake };
  }
  async findActiveLead(scope: OrganizationScope, input: { customerId: string; source: string }) {
    return this.leads.find((lead) => lead.organizationId === scope.organizationId && lead.customerId === input.customerId && lead.source === input.source && ["open", "working", "qualified"].includes(lead.status)) ?? null;
  }
  async resolveAssignee(_scope: OrganizationScope, input: { requestedUserId?: string }) { return input.requestedUserId; }
  async resolveVehicle(scope: OrganizationScope, input: InboundVehicleInterest) { void scope; void input; return this.vehicleResolution; }
  async createVehicleInterest(_context: RequestContext, input: { leadId: string; vehicleId: string }) { this.vehicleInterests.push(input); }
  async createIntake(_context: RequestContext, input: { id: string; leadId: string; customerId: string; source: string; sourceLeadId?: string; followUpTaskId: string; appointmentId?: string; communicationStatus: LeadIntakeRecord["communicationStatus"]; vehicle: VehicleResolution; receivedAt: string; idempotencyKey: string }) {
    const intake: LeadIntakeRecord = { id: input.id, leadId: input.leadId, customerId: input.customerId, followUpTaskId: input.followUpTaskId, ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}), communicationStatus: input.communicationStatus, vehicle: input.vehicle, receivedAt: input.receivedAt, idempotencyKey: input.idempotencyKey };
    this.intakes.push(intake); this.intakeSources.push({ intakeId: intake.id, source: input.source, ...(input.sourceLeadId ? { sourceLeadId: input.sourceLeadId } : {}) }); return intake;
  }
  async getAppointment(scope: OrganizationScope, id: string) { return this.appointments.find((item) => item.organizationId === scope.organizationId && item.id === id) ?? null; }
  async findAppointmentByIdempotencyKey(scope: OrganizationScope, key: string) { return this.appointments.find((item) => item.organizationId === scope.organizationId && item.idempotencyKey === key) ?? null; }
  async createAppointment(context: RequestContext, input: CreateAppointmentInput) {
    const record: AppointmentRecord = { ...input, status: "scheduled", createdAt: now, createdBy: context.actorId, updatedAt: now, updatedBy: context.actorId }; this.appointments.push(record); return record;
  }
  async findTaskByIdempotencyKey(scope: OrganizationScope, key: string) { return this.tasks.find((item) => item.organizationId === scope.organizationId && item.idempotencyKey === key) ?? null; }
  async createTask(context: RequestContext, input: CreateTaskInput) {
    const record: TaskRecord = { ...input, status: "open", createdAt: now, createdBy: context.actorId, updatedAt: now, updatedBy: context.actorId }; this.tasks.push(record); return record;
  }
}

function createService(provider: MemoryCRMProvider) {
  let sequence = 0;
  return new LeadIntakeService(provider, (prefix) => `${prefix}_test_${++sequence}`);
}

describe("LeadIntakeService", () => {
  it("creates a normalized customer and lead in one transaction", async () => {
    const provider = new MemoryCRMProvider();

    const result = await createService(provider).intake(createRequest());

    expect(result.customerCreated).toBe(true);
    expect(result.leadCreated).toBe(true);
    expect(result.customer.email).toBe("jordan.lee@example.com");
    expect(result.customer.phone).toBe("+12075550184");
    expect(result.lead.customerId).toBe(result.customer.id);
    expect(result.lead.stage).toBe("new");
    expect(result.lead.sourceDetail).toBe("2026 CR-V Hybrid landing page");
    expect(provider.transactionCount).toBe(1);
  });

  it("reuses an existing customer with matching tenant-scoped identity", async () => {
    const provider = new MemoryCRMProvider();
    provider.customers.push({
      id: "cus_existing",
      organizationId,
      locationId,
      displayName: "Jordan Lee",
      email: "jordan.lee@example.com",
      phone: "+12075550184",
      status: "active",
      createdAt: now,
      createdBy: "usr_existing",
      updatedAt: now,
      updatedBy: "usr_existing",
    });

    const result = await createService(provider).intake(createRequest());

    expect(result.customer.id).toBe("cus_existing");
    expect(result.customerCreated).toBe(false);
    expect(provider.customerWrites).toBe(0);
    expect(provider.leadWrites).toBe(1);
  });

  it.each([
    ["email", { email: "jordan.lee@example.com", phone: "+12075559999" }],
    ["phone", { email: "other@example.com", phone: "+12075550184" }],
  ])("deduplicates by normalized %s", async (_kind, customer) => {
    const provider = new MemoryCRMProvider();
    provider.customers.push({ id: "cus_existing", organizationId, locationId, displayName: "Existing", email: "jordan.lee@example.com", phone: "+12075550184", status: "active", createdAt: now, createdBy: "usr_existing", updatedAt: now, updatedBy: "usr_existing" });
    const result = await createService(provider).intake(createRequest({ customer: { displayName: "Jordan Lee", ...customer } }));
    expect(result.customer.id).toBe("cus_existing");
    expect(provider.customerWrites).toBe(0);
  });

  it("creates an independent buying cycle for a returning sold customer", async () => {
    const provider = new MemoryCRMProvider();
    const historicalCustomer: CustomerRecord = {
      id: "cus_returning",
      organizationId,
      locationId,
      displayName: "Jordan Lee",
      email: "jordan.lee@example.com",
      phone: "+12075550184",
      status: "active",
      createdAt: "2024-08-23T12:00:00.000Z",
      createdBy: "usr_salesperson",
      updatedAt: "2024-08-30T12:00:00.000Z",
      updatedBy: "usr_salesperson",
    };
    const historicalSale: LeadRecord = {
      id: "led_historical_sale",
      organizationId,
      locationId,
      customerId: historicalCustomer.id,
      assignedUserId: "usr_salesperson",
      source: "Returning Customer",
      stage: "Delivered",
      status: "sold",
      idempotencyKey: "historical-sale:2024",
      createdAt: "2024-08-23T12:00:00.000Z",
      createdBy: "usr_salesperson",
      updatedAt: "2024-08-30T12:00:00.000Z",
      updatedBy: "usr_salesperson",
    };
    provider.customers.push(historicalCustomer);
    provider.leads.push(historicalSale);

    const result = await createService(provider).intake(
      createRequest({
        idempotencyKey: "returning-customer:2026-cycle",
        source: "Returning Customer",
      }),
    );

    expect(result.customer.id).toBe(historicalCustomer.id);
    expect(result.customerCreated).toBe(false);
    expect(result.leadCreated).toBe(true);
    expect(result.lead.id).not.toBe(historicalSale.id);
    expect(result.lead.customerId).toBe(historicalSale.customerId);
    expect(result.lead.status).toBe("open");
    expect(provider.leads).toHaveLength(2);
    expect(provider.leads[0]).toEqual(historicalSale);
  });

  it("attaches a new intake event to an existing active source opportunity", async () => {
    const provider = new MemoryCRMProvider();
    const service = createService(provider);
    const first = await service.intake(createRequest());
    const second = await service.intake(createRequest({ idempotencyKey: "website-form:second-event" }));
    expect(second.lead.id).toBe(first.lead.id);
    expect(second.leadCreated).toBe(false);
    expect(provider.leads).toHaveLength(1);
    expect(provider.intakes).toHaveLength(2);
    expect(provider.tasks).toHaveLength(2);
  });

  it("returns the prior result for a repeated idempotency key", async () => {
    const provider = new MemoryCRMProvider();
    const service = createService(provider);

    const first = await service.intake(createRequest());
    const second = await service.intake(createRequest());

    expect(second.customer.id).toBe(first.customer.id);
    expect(second.lead.id).toBe(first.lead.id);
    expect(second.customerCreated).toBe(false);
    expect(second.leadCreated).toBe(false);
    expect(provider.customerWrites).toBe(1);
    expect(provider.leadWrites).toBe(1);
  });

  it("deduplicates a provider source ID even when the retry key changes", async () => {
    const provider = new MemoryCRMProvider();
    const service = createService(provider);
    const first = await service.intake(createRequest({ sourceLeadId: "provider-42" }));
    const second = await service.intake(createRequest({ sourceLeadId: "provider-42", idempotencyKey: "retry-2" }));
    expect(second.lead.id).toBe(first.lead.id);
    expect(provider.customers).toHaveLength(1);
    expect(provider.leads).toHaveLength(1);
    expect(provider.tasks).toHaveLength(1);
  });

  it("links a deterministically resolved vehicle and preserves no-match evidence", async () => {
    const known = new MemoryCRMProvider();
    known.vehicleResolution = { vehicleId: "veh_known", inventoryUnitId: "inv_known", method: "vin", label: "2026 Honda CR-V", resolved: true };
    const linked = await createService(known).intake(createRequest({ vehicleInterest: { vin: "1HGCM82633A004352" } }));
    expect(linked.intake.vehicle.resolved).toBe(true);
    expect(known.vehicleInterests).toHaveLength(1);
    expect(known.vehicleInterests[0]).toMatchObject({ leadId: linked.lead.id, vehicleId: "veh_known" });

    const unknown = new MemoryCRMProvider();
    const unresolved = await createService(unknown).intake(createRequest({ vehicleInterest: { year: 2026, make: "Honda", model: "Prelude" } }));
    expect(unresolved.intake.vehicle.resolved).toBe(false);
    expect(unknown.vehicleInterests).toHaveLength(0);
  });

  it("creates follow-up and appointment state without sending communication", async () => {
    const provider = new MemoryCRMProvider();
    const result = await createService(provider).intake(createRequest({
      appointmentRequest: { startsAt: "2026-09-10T14:00:00.000Z", endsAt: "2026-09-10T14:30:00.000Z", timezone: "America/New_York" },
    }));
    expect(result.followUpTask.title).toBe("Respond to Dealer Website lead");
    expect(result.appointment?.status).toBe("scheduled");
    expect(result.intake.communicationStatus).toBe("appointment-scheduled");
  });

  it("supports a lead with no vehicle or optional provider fields", async () => {
    const result = await createService(new MemoryCRMProvider()).intake(createRequest({ sourceDetail: undefined, vehicleInterest: undefined }));
    expect(result.intake.vehicle).toEqual({ label: "No vehicle supplied", resolved: false });
    expect(result.intake.communicationStatus).toBe("not-sent");
  });

  it("denies intake across organization boundaries before opening a transaction", async () => {
    const provider = new MemoryCRMProvider();
    const request = createRequest({ organizationId: "org_other" });

    await expect(createService(provider).intake(request)).rejects.toMatchObject({
      name: "AuthorizationError",
      reason: "organization-membership-required",
    } satisfies Partial<AuthorizationError>);
    expect(provider.transactionCount).toBe(0);
  });

  it("requires customer creation permission only when no customer matches", async () => {
    const provider = new MemoryCRMProvider();
    const actor = createActor(["lead.create", "lead.read", "customer.read"]);

    await expect(
      createService(provider).intake(createRequest({ actor })),
    ).rejects.toMatchObject({
      name: "AuthorizationError",
      reason: "capability-required",
    } satisfies Partial<AuthorizationError>);
    expect(provider.customerWrites).toBe(0);
    expect(provider.leadWrites).toBe(0);
  });

  it.each([
    [{ email: "not-an-email", phone: undefined }, "valid email"],
    [{ email: undefined, phone: "207-555-0184" }, "E.164"],
    [{ email: undefined, phone: undefined }, "email or phone"],
  ])("rejects invalid customer identity %o", async (customerIdentity, issue) => {
    const provider = new MemoryCRMProvider();
    const request = createRequest({
      customer: {
        displayName: "Jordan Lee",
        ...customerIdentity,
      },
    });

    await expect(createService(provider).intake(request)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof LeadIntakeValidationError &&
        error.issues.some((message) => message.includes(issue)),
    );
    expect(provider.transactionCount).toBe(0);
  });

  it("requires a dealership location before lead intake", async () => {
    const input = createRequest(); delete input.locationId;
    await expect(createService(new MemoryCRMProvider()).intake(input)).rejects.toSatisfy(
      (error: unknown) => error instanceof LeadIntakeValidationError && error.issues.includes("locationId is required."),
    );
  });
});
