import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type {
  CRMDataProvider,
  CRMDataSession,
  CustomerRecord,
  LeadRecord,
  OrganizationScope,
  RequestContext,
} from "@/lib/platform/data";
import { generateEntityId, type EntityIdPrefix } from "@/lib/core/identifiers";

export interface LeadIntakeRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  idempotencyKey: string;
  source: string;
  sourceDetail?: string;
  assignedUserId?: string;
  customer: {
    displayName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

export interface LeadIntakeResult {
  customer: CustomerRecord;
  lead: LeadRecord;
  customerCreated: boolean;
  leadCreated: boolean;
}

export class LeadIntakeValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Lead intake data is invalid.");
    this.name = "LeadIntakeValidationError";
    this.issues = [...issues];
  }
}

export class LeadIntakeIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadIntakeIntegrityError";
  }
}

export class LeadIntakeService {
  constructor(
    private readonly provider: CRMDataProvider,
    private readonly createId: (prefix: EntityIdPrefix) => string =
      generateEntityId,
  ) {}

  async intake(request: LeadIntakeRequest): Promise<LeadIntakeResult> {
    const normalized = validateAndNormalize(request);

    assertAuthorized(request.actor, {
      capability: "lead.create",
      organizationId: request.organizationId,
      locationId: request.locationId,
    });
    assertAuthorized(request.actor, {
      capability: "lead.read",
      organizationId: request.organizationId,
      locationId: request.locationId,
    });
    assertAuthorized(request.actor, {
      capability: "customer.read",
      organizationId: request.organizationId,
      locationId: request.locationId,
    });

    return this.provider.transaction(async (session) => {
      await session.acquireIdempotencyLock(request, request.idempotencyKey);
      const existingLead = await session.findLeadByIdempotencyKey(
        request,
        request.idempotencyKey,
      );

      if (existingLead) {
        const existingCustomer = await session.getCustomer(
          request,
          existingLead.customerId,
        );
        if (!existingCustomer) {
          throw new LeadIntakeIntegrityError(
            "The existing lead references an unavailable customer.",
          );
        }
        return {
          customer: existingCustomer,
          lead: existingLead,
          customerCreated: false,
          leadCreated: false,
        };
      }

      const identityLocks = [
        ...(normalized.email ? [`customer:identity:email:${normalized.email}`] : []),
        ...(normalized.phone ? [`customer:identity:phone:${normalized.phone}`] : []),
      ].sort();
      for (const key of identityLocks) {
        await session.acquireIdempotencyLock(request, key);
      }

      const customerResolution = await this.resolveCustomer(
        session,
        request,
        normalized,
      );
      const context: RequestContext = {
        actorId: request.actor.userId,
        organizationId: request.organizationId,
        correlationId: request.correlationId,
        ...(request.locationId ? { locationId: request.locationId } : {}),
      };
      const lead = await session.createLead(context, {
        id: this.createId("led"),
        organizationId: request.organizationId,
        ...(request.locationId ? { locationId: request.locationId } : {}),
        customerId: customerResolution.customer.id,
        source: normalized.source,
        ...(normalized.sourceDetail
          ? { sourceDetail: normalized.sourceDetail }
          : {}),
        ...(request.assignedUserId
          ? { assignedUserId: request.assignedUserId }
          : {}),
        stage: "new",
        idempotencyKey: request.idempotencyKey,
      });

      return {
        customer: customerResolution.customer,
        lead,
        customerCreated: customerResolution.created,
        leadCreated: true,
      };
    });
  }

  private async resolveCustomer(
    session: CRMDataSession,
    request: LeadIntakeRequest,
    normalized: NormalizedLeadIntake,
  ): Promise<{ customer: CustomerRecord; created: boolean }> {
    const existingCustomer = await session.findCustomerByIdentity({
      organizationId: request.organizationId,
      ...(request.locationId ? { locationId: request.locationId } : {}),
      ...(normalized.email ? { normalizedEmail: normalized.email } : {}),
      ...(normalized.phone ? { normalizedPhone: normalized.phone } : {}),
    });

    if (existingCustomer) {
      return { customer: existingCustomer, created: false };
    }

    assertAuthorized(request.actor, {
      capability: "customer.create",
      organizationId: request.organizationId,
      locationId: request.locationId,
    });

    const context: RequestContext = {
      actorId: request.actor.userId,
      organizationId: request.organizationId,
      correlationId: request.correlationId,
      ...(request.locationId ? { locationId: request.locationId } : {}),
    };
    const customer = await session.createCustomer(context, {
      id: this.createId("cus"),
      organizationId: request.organizationId,
      ...(request.locationId ? { locationId: request.locationId } : {}),
      displayName: normalized.displayName,
      ...(normalized.firstName ? { firstName: normalized.firstName } : {}),
      ...(normalized.lastName ? { lastName: normalized.lastName } : {}),
      ...(normalized.email
        ? { email: normalized.email, normalizedEmail: normalized.email }
        : {}),
      ...(normalized.phone
        ? { phone: normalized.phone, normalizedPhone: normalized.phone }
        : {}),
    });

    return { customer, created: true };
  }
}

interface NormalizedLeadIntake {
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source: string;
  sourceDetail?: string;
}

function validateAndNormalize(request: LeadIntakeRequest): NormalizedLeadIntake {
  const issues: string[] = [];
  const displayName = request.customer.displayName.trim();
  const source = request.source.trim();
  const email = request.customer.email?.trim().toLowerCase();
  const phone = request.customer.phone?.replace(/[\s().-]/g, "");

  if (!displayName) issues.push("customer.displayName is required.");
  if (!request.locationId?.trim()) issues.push("locationId is required.");
  if (!source) issues.push("source is required.");
  if (!request.correlationId.trim()) issues.push("correlationId is required.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (!email && !phone) {
    issues.push("A customer email or phone number is required for lead intake.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push("customer.email must be a valid email address.");
  }
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
    issues.push("customer.phone must be supplied in international E.164 format.");
  }
  if (issues.length > 0) throw new LeadIntakeValidationError(issues);

  return {
    displayName,
    source,
    ...(request.customer.firstName?.trim()
      ? { firstName: request.customer.firstName.trim() }
      : {}),
    ...(request.customer.lastName?.trim()
      ? { lastName: request.customer.lastName.trim() }
      : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(request.sourceDetail?.trim()
      ? { sourceDetail: request.sourceDetail.trim() }
      : {}),
  };
}
