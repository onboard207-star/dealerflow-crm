import { describe, expect, it } from "vitest";

import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type {
  CRMDataProvider,
  CRMDataSession,
  CreateCustomerInput,
  CreateLeadInput,
  CustomerIdentityQuery,
  CustomerQuery,
  CustomerRecord,
  LeadQuery,
  LeadRecord,
  OrganizationScope,
  PageResult,
  RequestContext,
} from "@/lib/platform/data";

import {
  LeadIntakeService,
  LeadIntakeValidationError,
  type LeadIntakeRequest,
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

class MemoryCRMProvider implements CRMDataProvider {
  readonly customers: CustomerRecord[] = [];
  readonly leads: LeadRecord[] = [];
  transactionCount = 0;
  customerWrites = 0;
  leadWrites = 0;

  async acquireIdempotencyLock() {}

  async transaction<Result>(
    operation: (session: CRMDataSession) => Promise<Result>,
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
          ((!query.normalizedEmail || customer.email === query.normalizedEmail) &&
            (!query.normalizedPhone || customer.phone === query.normalizedPhone)),
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

  async getAppointment() { return null; }
  async findAppointmentByIdempotencyKey() { return null; }
  async createAppointment(): Promise<never> {
    throw new Error("Not used by lead intake tests.");
  }
  async findTaskByIdempotencyKey() { return null; }
  async createTask(): Promise<never> {
    throw new Error("Not used by lead intake tests.");
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
