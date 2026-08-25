import { describe, expect, it } from "vitest";

import type {
  AppointmentRecord, CRMDataProvider, CRMDataSession, CreateAppointmentInput,
  CreateTaskInput,
  CustomerQuery, CustomerRecord, LeadQuery, LeadRecord, OrganizationScope,
  PageResult, RequestContext, TaskRecord,
} from "@/lib/platform/data";
import type { AuthorizationActor } from "@/lib/platform/auth";

import { AppointmentIntegrityError, AppointmentValidationError, ScheduleAppointmentService,
  type ScheduleAppointmentRequest } from "./schedule-appointment";

const now = "2026-08-23T12:00:00.000Z";
const audit = { createdAt: now, createdBy: "usr_sales", updatedAt: now, updatedBy: "usr_sales" };

class MemoryProvider implements CRMDataProvider {
  customers: CustomerRecord[] = [{ id: "cus_jordan", organizationId: "org_dealerflow", locationId: "loc_main", displayName: "Jordan Lee", status: "active", ...audit }];
  leads: LeadRecord[] = [{ id: "led_jordan", organizationId: "org_dealerflow", locationId: "loc_main", customerId: "cus_jordan", source: "Website", stage: "working", status: "open", idempotencyKey: "lead:1", ...audit }];
  appointments: AppointmentRecord[] = [];
  tasks: TaskRecord[] = [];
  transactions = 0;
  async acquireIdempotencyLock() {}
  async transaction<Result>(operation: (session: CRMDataSession) => Promise<Result>) { this.transactions++; return operation(this); }
  async getCustomer(scope: OrganizationScope, id: string) { return this.customers.find((x) => x.organizationId === scope.organizationId && x.id === id) ?? null; }
  async listCustomers(query: CustomerQuery): Promise<PageResult<CustomerRecord>> { return { records: this.customers.slice(0, query.limit) }; }
  async findCustomerByIdentity() { return null; }
  async createCustomer(): Promise<never> { throw new Error("unused"); }
  async getLead(scope: OrganizationScope, id: string) { return this.leads.find((x) => x.organizationId === scope.organizationId && x.id === id) ?? null; }
  async listLeads(query: LeadQuery): Promise<PageResult<LeadRecord>> { return { records: this.leads.slice(0, query.limit) }; }
  async findLeadByIdempotencyKey() { return null; }
  async createLead(): Promise<never> { throw new Error("unused"); }
  async getAppointment(scope: OrganizationScope, id: string) { return this.appointments.find((x) => x.organizationId === scope.organizationId && x.id === id) ?? null; }
  async findAppointmentByIdempotencyKey(scope: OrganizationScope, key: string) { return this.appointments.find((x) => x.organizationId === scope.organizationId && x.idempotencyKey === key) ?? null; }
  async createAppointment(context: RequestContext, input: CreateAppointmentInput) {
    const record: AppointmentRecord = { ...input, status: "scheduled", ...audit, createdBy: context.actorId, updatedBy: context.actorId };
    this.appointments.push(record); return record;
  }
  async findTaskByIdempotencyKey(scope: OrganizationScope, key: string) { return this.tasks.find((x) => x.organizationId === scope.organizationId && x.idempotencyKey === key) ?? null; }
  async createTask(context: RequestContext, input: CreateTaskInput) {
    const record: TaskRecord = { ...input, status: "open", ...audit, createdBy: context.actorId, updatedBy: context.actorId };
    this.tasks.push(record); return record;
  }
}

function actor(capabilities: AuthorizationActor["memberships"][number]["capabilities"] = [
  "customer.read", "lead.read", "appointment.read", "appointment.create", "task.read", "task.create",
]): AuthorizationActor {
  return { userId: "usr_sales", memberships: [{ organizationId: "org_dealerflow", locationIds: ["loc_main"], capabilities }] };
}

function request(overrides: Partial<ScheduleAppointmentRequest> = {}): ScheduleAppointmentRequest {
  return { actor: actor(), organizationId: "org_dealerflow", locationId: "loc_main",
    correlationId: "req_appointment", idempotencyKey: "appointment:1",
    customerId: "cus_jordan", leadId: "led_jordan", assignedUserId: "usr_sales",
    type: "Test Drive", startsAt: "2026-08-25T14:00:00.000Z",
    endsAt: "2026-08-25T15:00:00.000Z", timezone: "America/New_York",
    followUp: { title: "Confirm test drive", dueAt: "2026-08-24T14:00:00.000Z", priority: "high" }, ...overrides };
}

function service(provider: MemoryProvider) {
  let sequence = 0;
  return new ScheduleAppointmentService(provider, (prefix) => `${prefix}_test_${++sequence}`);
}

describe("ScheduleAppointmentService", () => {
  it("atomically schedules an appointment and linked follow-up task", async () => {
    const provider = new MemoryProvider();
    const result = await service(provider).schedule(request());
    expect(result.created).toBe(true);
    expect(result.followUpTask.appointmentId).toBe(result.appointment.id);
    expect(result.followUpTask.priority).toBe("high");
    expect(provider.transactions).toBe(1);
  });

  it("returns the existing pair for an idempotent retry", async () => {
    const provider = new MemoryProvider(); const scheduler = service(provider);
    const first = await scheduler.schedule(request());
    const second = await scheduler.schedule(request());
    expect(second.created).toBe(false);
    expect(second.appointment.id).toBe(first.appointment.id);
    expect(provider.appointments).toHaveLength(1); expect(provider.tasks).toHaveLength(1);
  });

  it("rejects a lead belonging to another customer", async () => {
    const provider = new MemoryProvider(); provider.leads[0] = { ...provider.leads[0]!, customerId: "cus_other" };
    await expect(service(provider).schedule(request())).rejects.toBeInstanceOf(AppointmentIntegrityError);
    expect(provider.appointments).toHaveLength(0);
  });

  it("denies scheduling without task creation permission", async () => {
    const limited = actor(["customer.read", "lead.read", "appointment.read", "appointment.create", "task.read"]);
    await expect(service(new MemoryProvider()).schedule(request({ actor: limited }))).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("rejects reversed appointment times and invalid timezone", async () => {
    await expect(service(new MemoryProvider()).schedule(request({ endsAt: "2026-08-25T13:00:00.000Z", timezone: "Dealer/Local" })))
      .rejects.toSatisfy((error: unknown) => error instanceof AppointmentValidationError && error.issues.length === 2);
  });

  it("requires a dealership location and rejects mismatched record locations", async () => {
    const missing = request(); delete missing.locationId;
    await expect(service(new MemoryProvider()).schedule(missing)).rejects.toBeInstanceOf(AppointmentValidationError);
    const provider = new MemoryProvider(); provider.leads[0] = { ...provider.leads[0]!, locationId: "loc_other" };
    await expect(service(provider).schedule(request())).rejects.toBeInstanceOf(AppointmentIntegrityError);
  });
});
