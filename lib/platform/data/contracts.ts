export interface OrganizationScope {
  organizationId: string;
  locationId?: string;
}

export interface RequestContext extends OrganizationScope {
  actorId: string;
  correlationId: string;
}

export interface PageRequest {
  cursor?: string;
  limit: number;
}

export interface PageResult<RecordType> {
  records: readonly RecordType[];
  nextCursor?: string;
}

export interface AuditMetadata {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CustomerRecord extends OrganizationScope, AuditMetadata {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status: string;
}

export interface LeadRecord extends OrganizationScope, AuditMetadata {
  id: string;
  customerId: string;
  assignedUserId?: string;
  source: string;
  sourceDetail?: string;
  stage: string;
  status: string;
  idempotencyKey: string;
}

export interface CreateCustomerInput extends OrganizationScope {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  normalizedEmail?: string;
  phone?: string;
  normalizedPhone?: string;
}

export interface CreateLeadInput extends OrganizationScope {
  id: string;
  customerId: string;
  source: string;
  sourceDetail?: string;
  assignedUserId?: string;
  stage: string;
  idempotencyKey: string;
}

export interface AppointmentRecord extends OrganizationScope, AuditMetadata {
  id: string;
  customerId: string;
  leadId?: string;
  assignedUserId?: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  notes?: string;
  idempotencyKey: string;
}

export interface CreateAppointmentInput extends OrganizationScope {
  id: string;
  customerId: string;
  leadId?: string;
  assignedUserId?: string;
  type: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  notes?: string;
  idempotencyKey: string;
}

export interface TaskRecord extends OrganizationScope, AuditMetadata {
  id: string;
  customerId: string;
  leadId?: string;
  appointmentId?: string;
  assignedUserId?: string;
  title: string;
  status: string;
  priority: string;
  dueAt?: string;
  idempotencyKey: string;
}

export interface CreateTaskInput extends OrganizationScope {
  id: string;
  customerId: string;
  leadId?: string;
  appointmentId?: string;
  assignedUserId?: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueAt?: string;
  idempotencyKey: string;
}

export interface CustomerQuery extends OrganizationScope, PageRequest {
  search?: string;
}

export interface LeadQuery extends OrganizationScope, PageRequest {
  customerId?: string;
  assignedUserId?: string;
  stage?: string;
  status?: string;
}

export interface CustomerIdentityQuery extends OrganizationScope {
  normalizedEmail?: string;
  normalizedPhone?: string;
}

export interface CRMDataSession {
  acquireIdempotencyLock(
    scope: OrganizationScope,
    idempotencyKey: string,
  ): Promise<void>;
  getCustomer(
    scope: OrganizationScope,
    customerId: string,
  ): Promise<CustomerRecord | null>;
  listCustomers(query: CustomerQuery): Promise<PageResult<CustomerRecord>>;
  findCustomerByIdentity(
    query: CustomerIdentityQuery,
  ): Promise<CustomerRecord | null>;
  createCustomer(
    context: RequestContext,
    input: CreateCustomerInput,
  ): Promise<CustomerRecord>;
  getLead(
    scope: OrganizationScope,
    leadId: string,
  ): Promise<LeadRecord | null>;
  listLeads(query: LeadQuery): Promise<PageResult<LeadRecord>>;
  findLeadByIdempotencyKey(
    scope: OrganizationScope,
    idempotencyKey: string,
  ): Promise<LeadRecord | null>;
  createLead(
    context: RequestContext,
    input: CreateLeadInput,
  ): Promise<LeadRecord>;
  getAppointment(
    scope: OrganizationScope,
    appointmentId: string,
  ): Promise<AppointmentRecord | null>;
  findAppointmentByIdempotencyKey(
    scope: OrganizationScope,
    idempotencyKey: string,
  ): Promise<AppointmentRecord | null>;
  createAppointment(
    context: RequestContext,
    input: CreateAppointmentInput,
  ): Promise<AppointmentRecord>;
  findTaskByIdempotencyKey(
    scope: OrganizationScope,
    idempotencyKey: string,
  ): Promise<TaskRecord | null>;
  createTask(
    context: RequestContext,
    input: CreateTaskInput,
  ): Promise<TaskRecord>;
}

export interface CRMDataProvider extends CRMDataSession {
  transaction<Result>(
    operation: (session: CRMDataSession) => Promise<Result>,
  ): Promise<Result>;
}
