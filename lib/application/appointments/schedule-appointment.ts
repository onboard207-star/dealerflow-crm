import { generateEntityId, type EntityIdPrefix } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type {
  AppointmentRecord,
  CRMDataProvider,
  RequestContext,
  TaskRecord,
} from "@/lib/platform/data";

export interface ScheduleAppointmentRequest {
  actor: AuthorizationActor;
  organizationId: string;
  locationId?: string;
  correlationId: string;
  idempotencyKey: string;
  customerId: string;
  leadId: string;
  assignedUserId?: string;
  type: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  notes?: string;
  followUp: {
    title: string;
    dueAt: string;
    priority?: "low" | "normal" | "high" | "urgent";
  };
}

export interface ScheduleAppointmentResult {
  appointment: AppointmentRecord;
  followUpTask: TaskRecord;
  created: boolean;
}

export class AppointmentValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super("Appointment data is invalid.");
    this.name = "AppointmentValidationError";
    this.issues = [...issues];
  }
}

export class AppointmentIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentIntegrityError";
  }
}

export class ScheduleAppointmentService {
  constructor(
    private readonly provider: CRMDataProvider,
    private readonly createId: (prefix: EntityIdPrefix) => string = generateEntityId,
  ) {}

  async schedule(request: ScheduleAppointmentRequest): Promise<ScheduleAppointmentResult> {
    const input = validate(request);
    for (const capability of [
      "customer.read", "lead.read", "appointment.read", "appointment.create",
      "task.read", "task.create",
    ] as const) {
      assertAuthorized(request.actor, {
        capability,
        organizationId: request.organizationId,
        locationId: request.locationId,
      });
    }

    return this.provider.transaction(async (session) => {
      const taskKey = `${input.idempotencyKey}:follow-up`;
      await session.acquireIdempotencyLock(request, input.idempotencyKey);
      const existing = await session.findAppointmentByIdempotencyKey(request, input.idempotencyKey);
      if (existing) {
        const task = await session.findTaskByIdempotencyKey(request, taskKey);
        if (!task || task.appointmentId !== existing.id) {
          throw new AppointmentIntegrityError("The existing appointment follow-up is incomplete.");
        }
        return { appointment: existing, followUpTask: task, created: false };
      }

      const [customer, lead] = await Promise.all([
        session.getCustomer(request, input.customerId),
        session.getLead(request, input.leadId),
      ]);
      if (!customer) throw new AppointmentIntegrityError("Customer is unavailable.");
      if (!lead || lead.customerId !== customer.id) {
        throw new AppointmentIntegrityError("Lead does not belong to the customer.");
      }
      if ((customer.locationId && customer.locationId !== input.locationId) || (lead.locationId && lead.locationId !== input.locationId)) {
        throw new AppointmentIntegrityError("Customer or Lead is unavailable at this location.");
      }
      const context: RequestContext = {
        actorId: request.actor.userId,
        organizationId: input.organizationId,
        correlationId: input.correlationId,
        ...(input.locationId ? { locationId: input.locationId } : {}),
      };
      const appointment = await session.createAppointment(context, {
        id: this.createId("apt"), organizationId: input.organizationId,
        ...(input.locationId ? { locationId: input.locationId } : {}),
        customerId: input.customerId, leadId: input.leadId,
        ...(input.assignedUserId ? { assignedUserId: input.assignedUserId } : {}),
        type: input.type, startsAt: input.startsAt, endsAt: input.endsAt,
        timezone: input.timezone, ...(input.notes ? { notes: input.notes } : {}),
        idempotencyKey: input.idempotencyKey,
      });
      const followUpTask = await session.createTask(context, {
        id: this.createId("tsk"), organizationId: input.organizationId,
        ...(input.locationId ? { locationId: input.locationId } : {}),
        customerId: input.customerId, leadId: input.leadId,
        appointmentId: appointment.id,
        ...(input.assignedUserId ? { assignedUserId: input.assignedUserId } : {}),
        title: input.followUp.title, dueAt: input.followUp.dueAt,
        priority: input.followUp.priority ?? "normal", idempotencyKey: taskKey,
      });
      return { appointment, followUpTask, created: true };
    });
  }
}

function validate(request: ScheduleAppointmentRequest): ScheduleAppointmentRequest {
  const issues: string[] = [];
  const startsAt = new Date(request.startsAt);
  const endsAt = new Date(request.endsAt);
  const dueAt = new Date(request.followUp.dueAt);
  if (!request.customerId.trim()) issues.push("customerId is required.");
  if (!request.locationId?.trim()) issues.push("locationId is required.");
  if (!request.leadId.trim()) issues.push("leadId is required.");
  if (!request.type.trim()) issues.push("type is required.");
  if (!request.timezone.trim()) issues.push("timezone is required.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (!request.correlationId.trim()) issues.push("correlationId is required.");
  if (!request.followUp.title.trim()) issues.push("followUp.title is required.");
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf())) {
    issues.push("Appointment times must be valid ISO timestamps.");
  } else if (endsAt <= startsAt) issues.push("endsAt must be after startsAt.");
  if (Number.isNaN(dueAt.valueOf())) issues.push("followUp.dueAt must be a valid ISO timestamp.");
  else if (!Number.isNaN(startsAt.valueOf()) && dueAt > startsAt) {
    issues.push("followUp.dueAt cannot be after startsAt.");
  }
  try { new Intl.DateTimeFormat("en-US", { timeZone: request.timezone }); }
  catch { issues.push("timezone must be a valid IANA timezone."); }
  if (issues.length) throw new AppointmentValidationError(issues);
  return { ...request, type: request.type.trim(), timezone: request.timezone.trim(),
    notes: request.notes?.trim(), followUp: { ...request.followUp, title: request.followUp.title.trim() } };
}
