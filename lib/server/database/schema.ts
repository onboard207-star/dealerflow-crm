import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tenantVerticalEnum = pgEnum("tenant_vertical", [
  "automotive",
  "marine",
  "powersports",
  "inventory-sales",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
  "revoked",
]);
export const organizationInvitationStatusEnum = pgEnum("organization_invitation_status", ["pending", "accepted", "revoked", "expired"]);

export const customerStatusEnum = pgEnum("customer_status", [
  "active",
  "inactive",
  "archived",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "open",
  "working",
  "qualified",
  "sold",
  "lost",
  "archived",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "cancelled",
  "no-show",
]);
export const showroomVisitStatusEnum=pgEnum("showroom_visit_status",["checked-in","active","completed","cancelled"]);

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in-progress",
  "completed",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const communicationChannelEnum = pgEnum("communication_channel", [
  "call",
  "sms",
  "email",
]);

export const communicationDirectionEnum = pgEnum("communication_direction", [
  "inbound",
  "outbound",
]);

export const communicationStatusEnum = pgEnum("communication_status", [
  "attempted",
  "sent",
  "delivered",
  "received",
  "failed",
]);

export const integrationEventStatusEnum = pgEnum("integration_event_status", [
  "pending",
  "processed",
  "unmatched",
  "failed",
]);

export const consentActionEnum = pgEnum("consent_action", ["granted", "revoked"]);
export const consentPurposeEnum = pgEnum("consent_purpose", ["operational", "marketing"]);
export const consentBasisEnum = pgEnum("consent_basis", ["express-written", "customer-initiated", "not-applicable"]);
export const sendAttemptStatusEnum = pgEnum("send_attempt_status", [
  "queued", "dispatching", "accepted", "delivery-unknown", "rejected",
]);
export const inventoryStatusEnum = pgEnum("inventory_status", [
  "available", "hold", "sold", "unavailable",
]);
export const vehicleInterestRoleEnum = pgEnum("vehicle_interest_role", [
  "primary", "alternative", "trade",
]);
export const vehicleInterestStatusEnum = pgEnum("vehicle_interest_status", [
  "active", "inactive", "purchased", "traded",
]);
export const dealStatusEnum = pgEnum("deal_status", [
  "draft", "working", "pending-approval", "approved", "contracted", "delivered", "cancelled",
]);
export const purchaseTypeEnum = pgEnum("purchase_type", ["cash", "finance", "lease"]);
export const quoteStatusEnum = pgEnum("quote_status", ["draft", "presented", "accepted", "rejected", "expired"]);
export const quoteLineCategoryEnum = pgEnum("quote_line_category", ["vehicle", "product", "accessory", "fee", "tax", "discount"]);
export const tradeAppraisalStatusEnum = pgEnum("trade_appraisal_status", ["draft", "presented", "accepted", "rejected", "expired", "acquired"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["scheduled", "ready", "completed", "cancelled"]);
export const transactionalEmailKindEnum = pgEnum("transactional_email_kind", ["email-verification", "password-reset", "organization-invitation"]);
export const transactionalEmailStatusEnum = pgEnum("transactional_email_status", ["queued", "sending", "sent", "failed"]);
export const aiRecommendationStatusEnum = pgEnum("ai_recommendation_status", ["pending","completed","refused","failed"]);
export const aiReviewDecisionEnum = pgEnum("ai_review_decision", ["accepted","dismissed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const transactionalEmailMessages = pgTable(
  "transactional_email_messages",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    invitationId: text("invitation_id"),
    kind: transactionalEmailKindEnum("kind").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body").notNull(),
    status: transactionalEmailStatusEnum("status").default("queued").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    notBefore: timestamp("not_before", { withTimezone: true }).defaultNow().notNull(),
    lastErrorCode: text("last_error_code"),
    providerMessageId: text("provider_message_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps,
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("transactional_email_idempotency_unique").on(table.idempotencyKey),
    index("transactional_email_due_idx").on(table.notBefore, table.createdAt),
    index("transactional_email_invitation_idx").on(table.organizationId, table.invitationId, table.createdAt),
    check("transactional_email_id_format", sql`${table.id} ~ '^tem_[a-z0-9_-]{6,64}$'`),
    check("transactional_email_attempt_count", sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= 10`),
    check("transactional_email_invitation_scope", sql`(${table.invitationId} is null) = (${table.organizationId} is null)`),
    foreignKey({ columns: [table.organizationId, table.invitationId], foreignColumns: [organizationInvitations.organizationId, organizationInvitations.id], name: "transactional_email_same_org_invitation_fk" }),
  ],
);

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    vertical: tenantVerticalEnum("vertical").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(table.slug),
    check("organizations_id_format", sql`${table.id} ~ '^org_[a-z0-9_-]{6,64}$'`),
    check("organizations_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

export const organizationConfigurations = pgTable(
  "organization_configurations",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productName: text("product_name").notNull(),
    customDomain: text("custom_domain"),
    brand: jsonb("brand").$type<Record<string, unknown>>().default({}).notNull(),
    features: jsonb("features")
      .$type<Record<string, boolean>>()
      .default({})
      .notNull(),
    terminology: jsonb("terminology")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    version: text("version").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_configurations_domain_unique")
      .on(table.customDomain)
      .where(sql`${table.customDomain} is not null`),
  ],
);

export const organizationConfigurationVersions = pgTable("organization_configuration_versions",{
  id:text("id").primaryKey(),organizationId:text("organization_id").notNull().references(()=>organizations.id,{onDelete:"restrict"}),configuration:jsonb("configuration").$type<Record<string,unknown>>().notNull(),changeKind:text("change_kind").notNull(),restoredFromId:text("restored_from_id"),createdBy:text("created_by").references(()=>users.id,{onDelete:"restrict"}),createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},(table)=>[uniqueIndex("configuration_versions_organization_id_unique").on(table.organizationId,table.id),index("configuration_versions_created_idx").on(table.organizationId,table.createdAt),foreignKey({columns:[table.organizationId,table.restoredFromId],foreignColumns:[table.organizationId,table.id],name:"configuration_versions_same_org_restore_fk"}),check("configuration_versions_id_format",sql`${table.id} ~ '^ocv_[a-z0-9_-]{6,64}$'`),check("configuration_versions_change_kind",sql`${table.changeKind} in ('update','rollback')`),check("configuration_versions_restore_consistency",sql`(${table.changeKind}='rollback')=(${table.restoredFromId} is not null)`)]);

export const locations = pgTable(
  "locations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("locations_organization_slug_unique").on(
      table.organizationId,
      table.slug,
    ),
    uniqueIndex("locations_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("locations_organization_idx").on(table.organizationId),
    check("locations_id_format", sql`${table.id} ~ '^loc_[a-z0-9_-]{6,64}$'`),
  ],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    imageUrl: text("image_url"),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
    check("users_id_format", sql`${table.id} ~ '^usr_[a-z0-9_-]{6,64}$'`),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_sessions_token_unique").on(table.token),
    index("auth_sessions_user_idx").on(table.userId),
  ],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_accounts_issuer_account_unique").on(
      table.issuer,
      table.accountId,
    ),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("auth_verifications_identifier_idx").on(table.identifier),
  ],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: membershipStatusEnum("status").default("invited").notNull(),
    allLocations: boolean("all_locations").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    uniqueIndex("organization_memberships_org_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("organization_memberships_user_idx").on(table.userId),
    check(
      "organization_memberships_id_format",
      sql`${table.id} ~ '^mem_[a-z0-9_-]{6,64}$'`,
    ),
  ],
);

export const membershipLocations = pgTable(
  "membership_locations",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.membershipId, table.locationId] }),
    index("membership_locations_organization_idx").on(table.organizationId),
    foreignKey({
      columns: [table.organizationId, table.membershipId],
      foreignColumns: [
        organizationMemberships.organizationId,
        organizationMemberships.id,
      ],
      name: "membership_locations_same_organization_membership_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.locationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "membership_locations_same_organization_location_fk",
    }),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    system: boolean("system").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("roles_organization_key_unique").on(
      table.organizationId,
      table.key,
    ),
    uniqueIndex("roles_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    check("roles_id_format", sql`${table.id} ~ '^rol_[a-z0-9_-]{6,64}$'`),
  ],
);

export const roleCapabilities = pgTable(
  "role_capabilities",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    capability: text("capability").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.capability] }),
    index("role_capabilities_organization_idx").on(table.organizationId),
    foreignKey({
      columns: [table.organizationId, table.roleId],
      foreignColumns: [roles.organizationId, roles.id],
      name: "role_capabilities_same_organization_role_fk",
    }),
  ],
);

export const membershipRoles = pgTable(
  "membership_roles",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.membershipId, table.roleId] }),
    index("membership_roles_organization_idx").on(table.organizationId),
    foreignKey({
      columns: [table.organizationId, table.membershipId],
      foreignColumns: [
        organizationMemberships.organizationId,
        organizationMemberships.id,
      ],
      name: "membership_roles_same_organization_membership_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.roleId],
      foreignColumns: [roles.organizationId, roles.id],
      name: "membership_roles_same_organization_role_fk",
    }),
  ],
);

export const organizationInvitations = pgTable("organization_invitations", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(), tokenHash: text("token_hash").notNull(), idempotencyKey: text("idempotency_key").notNull(), status: organizationInvitationStatusEnum("status").default("pending").notNull(),
  allLocations: boolean("all_locations").default(false).notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), invitedBy: text("invited_by").references(() => users.id, { onDelete: "restrict" }),
  acceptedBy: text("accepted_by").references(() => users.id, { onDelete: "set null" }), acceptedAt: timestamp("accepted_at", { withTimezone: true }), resendCount: integer("resend_count").default(0).notNull(), lastSentAt: timestamp("last_sent_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }), revokedBy: text("revoked_by").references(() => users.id, { onDelete: "set null" }), ...timestamps,
}, (table) => [
  uniqueIndex("organization_invitations_token_unique").on(table.tokenHash), uniqueIndex("organization_invitations_org_id_unique").on(table.organizationId, table.id), uniqueIndex("organization_invitations_idempotency_unique").on(table.organizationId, table.idempotencyKey),
  uniqueIndex("organization_invitations_pending_email_unique").on(table.organizationId, sql`lower(${table.email})`).where(sql`${table.status} = 'pending'`), index("organization_invitations_org_status_idx").on(table.organizationId, table.status, table.createdAt), index("organization_invitations_rate_limit_idx").on(table.organizationId, table.invitedBy, table.createdAt),
  check("organization_invitations_id_format", sql`${table.id} ~ '^oin_[a-z0-9_-]{6,64}$'`), check("organization_invitations_expiry", sql`${table.expiresAt} > ${table.createdAt}`), check("organization_invitations_resend_limit", sql`${table.resendCount} between 0 and 10`),check("organization_invitations_operator_source",sql`${table.invitedBy} is not null or ${table.idempotencyKey} like 'operator-provision:%'`),
]);

export const organizationInvitationRoles = pgTable("organization_invitation_roles", {
  invitationId: text("invitation_id").notNull().references(() => organizationInvitations.id, { onDelete: "cascade" }), organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.invitationId, table.roleId] }), foreignKey({ columns: [table.organizationId, table.invitationId], foreignColumns: [organizationInvitations.organizationId, organizationInvitations.id], name: "invitation_roles_same_org_invitation_fk" })]);

export const organizationInvitationLocations = pgTable("organization_invitation_locations", {
  invitationId: text("invitation_id").notNull().references(() => organizationInvitations.id, { onDelete: "cascade" }), organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.invitationId, table.locationId] }), foreignKey({ columns: [table.organizationId, table.invitationId], foreignColumns: [organizationInvitations.organizationId, organizationInvitations.id], name: "invitation_locations_same_org_invitation_fk" }), foreignKey({ columns: [table.organizationId, table.locationId], foreignColumns: [locations.organizationId, locations.id], name: "invitation_locations_same_org_location_fk" })]);

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    normalizedEmail: text("normalized_email"),
    phone: text("phone"),
    normalizedPhone: text("normalized_phone"),
    status: customerStatusEnum("status").default("active").notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("customers_organization_idx").on(table.organizationId),
    uniqueIndex("customers_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("customers_organization_location_idx").on(
      table.organizationId,
      table.locationId,
    ),
    index("customers_organization_email_idx").on(
      table.organizationId,
      table.normalizedEmail,
    ),
    index("customers_organization_phone_idx").on(
      table.organizationId,
      table.normalizedPhone,
    ),
    index("customers_organization_name_search_idx").on(
      table.organizationId,
      sql`lower(${table.displayName}) text_pattern_ops`,
    ),
    foreignKey({
      columns: [table.organizationId, table.locationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "customers_same_organization_location_fk",
    }),
    check("customers_id_format", sql`${table.id} ~ '^cus_[a-z0-9_-]{6,64}$'`),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    assignedUserId: text("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull(),
    sourceDetail: text("source_detail"),
    stage: text("stage").notNull(),
    status: leadStatusEnum("status").default("open").notNull(),
    idempotencyKey: text("idempotency_key"),
    lostReason: text("lost_reason"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("leads_organization_idx").on(table.organizationId),
    uniqueIndex("leads_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("leads_organization_customer_id_unique").on(
      table.organizationId,
      table.customerId,
      table.id,
    ),
    index("leads_organization_customer_idx").on(
      table.organizationId,
      table.customerId,
    ),
    index("leads_organization_assignee_idx").on(
      table.organizationId,
      table.assignedUserId,
    ),
    index("leads_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
      table.id,
    ),
    uniqueIndex("leads_organization_idempotency_unique")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    foreignKey({
      columns: [table.organizationId, table.locationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "leads_same_organization_location_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "leads_same_organization_customer_fk",
    }),
    check("leads_id_format", sql`${table.id} ~ '^led_[a-z0-9_-]{6,64}$'`),
    check("leads_lost_reason_consistent", sql`(${table.status}='lost')=(${table.lostReason} is not null)`),
    check("leads_lost_reason_length", sql`${table.lostReason} is null or length(trim(${table.lostReason})) between 1 and 1000`),
  ],
);

export const leadStatusEvents=pgTable("lead_status_events",{id:text("id").primaryKey(),organizationId:text("organization_id").notNull(),leadId:text("lead_id").notNull(),fromStatus:leadStatusEnum("from_status"),toStatus:leadStatusEnum("to_status").notNull(),reason:text("reason"),occurredAt:timestamp("occurred_at",{withTimezone:true}).defaultNow().notNull(),idempotencyKey:text("idempotency_key").notNull(),createdBy:text("created_by").notNull().references(()=>users.id,{onDelete:"restrict"})},(table)=>[uniqueIndex("lead_status_events_organization_id_unique").on(table.organizationId,table.id),uniqueIndex("lead_status_events_idempotency_unique").on(table.organizationId,table.idempotencyKey),index("lead_status_events_lead_time_idx").on(table.organizationId,table.leadId,table.occurredAt),foreignKey({columns:[table.organizationId,table.leadId],foreignColumns:[leads.organizationId,leads.id],name:"lead_status_events_same_lead_fk"}),check("lead_status_events_id_format",sql`${table.id} ~ '^lse_[a-z0-9_-]{6,64}$'`),check("lead_status_events_reason_length",sql`${table.reason} is null or length(trim(${table.reason})) between 1 and 1000`),check("lead_status_events_status_change",sql`${table.fromStatus} is null or ${table.fromStatus}<>${table.toStatus}`)]);

export const aiRecommendationRuns=pgTable("ai_recommendation_runs",{
  id:text("id").primaryKey(),organizationId:text("organization_id").notNull().references(()=>organizations.id,{onDelete:"restrict"}),customerId:text("customer_id").notNull().references(()=>customers.id,{onDelete:"restrict"}),leadId:text("lead_id").references(()=>leads.id,{onDelete:"set null"}),promptVersion:text("prompt_version").notNull(),model:text("model"),status:aiRecommendationStatusEnum("status").default("pending").notNull(),evidence:jsonb("evidence").$type<readonly Record<string,unknown>[]>().notNull(),output:jsonb("output").$type<Record<string,unknown>>(),refusal:text("refusal"),providerResponseId:text("provider_response_id"),inputTokens:integer("input_tokens"),outputTokens:integer("output_tokens"),latencyMs:integer("latency_ms"),failureCode:text("failure_code"),idempotencyKey:text("idempotency_key").notNull(),initiatedBy:text("initiated_by").notNull().references(()=>users.id,{onDelete:"restrict"}),reviewDecision:aiReviewDecisionEnum("review_decision"),reviewNote:text("review_note"),reviewedBy:text("reviewed_by").references(()=>users.id,{onDelete:"set null"}),reviewedAt:timestamp("reviewed_at",{withTimezone:true}),...timestamps,
},(table)=>[
  uniqueIndex("ai_runs_organization_id_unique").on(table.organizationId,table.id),uniqueIndex("ai_runs_organization_idempotency_unique").on(table.organizationId,table.idempotencyKey),uniqueIndex("ai_runs_customer_pending_unique").on(table.organizationId,table.customerId).where(sql`${table.status}='pending'`),index("ai_runs_actor_rate_limit_idx").on(table.organizationId,table.initiatedBy,table.createdAt),index("ai_runs_customer_created_idx").on(table.organizationId,table.customerId,table.createdAt),foreignKey({columns:[table.organizationId,table.customerId,table.leadId],foreignColumns:[leads.organizationId,leads.customerId,leads.id],name:"ai_runs_same_customer_lead_fk"}),check("ai_runs_id_format",sql`${table.id} ~ '^air_[a-z0-9_-]{6,64}$'`),check("ai_runs_latency",sql`${table.latencyMs} is null or ${table.latencyMs}>=0`),
]);

export const vehicles = pgTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
    vin: text("vin").notNull(),
    year: integer("year").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim"),
    exteriorColor: text("exterior_color"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vehicles_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("vehicles_organization_vin_unique").on(table.organizationId, table.vin),
    index("vehicles_organization_description_idx").on(table.organizationId, table.year, table.make, table.model),
    check("vehicles_id_format", sql`${table.id} ~ '^veh_[a-z0-9_-]{6,64}$'`),
    check("vehicles_vin_format", sql`${table.vin} ~ '^[A-HJ-NPR-Z0-9]{17}$'`),
    check("vehicles_year_range", sql`${table.year} between 1886 and 2200`),
  ],
);

export const inventoryUnits = pgTable(
  "inventory_units",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: text("location_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    stockNumber: text("stock_number").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: inventoryStatusEnum("status").default("available").notNull(),
    listPriceCents: integer("list_price_cents"),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_units_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("inventory_units_organization_vehicle_id_unique").on(table.organizationId, table.vehicleId, table.id),
    uniqueIndex("inventory_units_organization_location_vehicle_id_unique").on(table.organizationId, table.locationId, table.vehicleId, table.id),
    uniqueIndex("inventory_units_organization_stock_unique").on(table.organizationId, table.stockNumber),
    uniqueIndex("inventory_units_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("inventory_units_active_vehicle_unique").on(table.organizationId, table.vehicleId)
      .where(sql`${table.status} in ('available', 'hold')`),
    index("inventory_units_location_status_idx").on(table.organizationId, table.locationId, table.status),
    foreignKey({ columns: [table.organizationId, table.locationId], foreignColumns: [locations.organizationId, locations.id], name: "inventory_units_same_organization_location_fk" }),
    foreignKey({ columns: [table.organizationId, table.vehicleId], foreignColumns: [vehicles.organizationId, vehicles.id], name: "inventory_units_same_organization_vehicle_fk" }),
    check("inventory_units_id_format", sql`${table.id} ~ '^inv_[a-z0-9_-]{6,64}$'`),
    check("inventory_units_price_nonnegative", sql`${table.listPriceCents} is null or ${table.listPriceCents} >= 0`),
    check("inventory_units_sold_consistency", sql`${table.status} <> 'sold' or ${table.soldAt} is not null`),
  ],
);

export const inventoryUnitEvents=pgTable("inventory_unit_events",{id:text("id").primaryKey(),organizationId:text("organization_id").notNull(),inventoryUnitId:text("inventory_unit_id").notNull(),kind:text("kind").notNull(),fromStatus:inventoryStatusEnum("from_status"),toStatus:inventoryStatusEnum("to_status").notNull(),oldPriceCents:integer("old_price_cents"),newPriceCents:integer("new_price_cents"),reason:text("reason"),occurredAt:timestamp("occurred_at",{withTimezone:true}).defaultNow().notNull(),idempotencyKey:text("idempotency_key").notNull(),createdBy:text("created_by").notNull().references(()=>users.id,{onDelete:"restrict"})},(table)=>[uniqueIndex("inventory_unit_events_organization_id_unique").on(table.organizationId,table.id),uniqueIndex("inventory_unit_events_idempotency_unique").on(table.organizationId,table.idempotencyKey),index("inventory_unit_events_inventory_time_idx").on(table.organizationId,table.inventoryUnitId,table.occurredAt),foreignKey({columns:[table.organizationId,table.inventoryUnitId],foreignColumns:[inventoryUnits.organizationId,inventoryUnits.id],name:"inventory_unit_events_same_inventory_fk"}),check("inventory_unit_events_id_format",sql`${table.id} ~ '^iue_[a-z0-9_-]{6,64}$'`),check("inventory_unit_events_kind",sql`${table.kind} in ('created','pricing','status')`),check("inventory_unit_events_price_nonnegative",sql`(${table.oldPriceCents} is null or ${table.oldPriceCents}>=0) and (${table.newPriceCents} is null or ${table.newPriceCents}>=0)`),check("inventory_unit_events_reason_length",sql`${table.reason} is null or length(trim(${table.reason})) between 1 and 1000`)]);

export const inventoryUnitMedia = pgTable("inventory_unit_media", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  locationId: text("location_id").notNull(),
  vehicleId: text("vehicle_id").notNull(),
  inventoryUnitId: text("inventory_unit_id").notNull(),
  provider: text("provider").notNull(),
  providerAssetId: text("provider_asset_id").notNull(),
  deliveryUrl: text("delivery_url").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  sha256: text("sha256").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  altText: text("alt_text").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  sourceType: text("source_type").default("actual").notNull(),
  mediaType: text("media_type").default("image").notNull(),
  originalFilename: text("original_filename"),
  isPrimary: boolean("is_primary").default(false).notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  verifiedBy: text("verified_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  status: text("status").default("active").notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedBy: text("removed_by").references(() => users.id, { onDelete: "restrict" }),
  removalReason: text("removal_reason"),
  ...timestamps,
}, (table) => [
  uniqueIndex("inventory_unit_media_organization_id_unique").on(table.organizationId, table.id),
  uniqueIndex("inventory_unit_media_provider_asset_unique").on(table.organizationId, table.provider, table.providerAssetId),
  index("inventory_unit_media_inventory_order_idx").on(table.organizationId, table.inventoryUnitId, table.status, table.sortOrder),
  uniqueIndex("inventory_unit_media_one_primary_active").on(table.organizationId, table.inventoryUnitId).where(sql`${table.status}='active' and ${table.isPrimary}=true`),
  foreignKey({ columns: [table.organizationId, table.locationId, table.vehicleId, table.inventoryUnitId], foreignColumns: [inventoryUnits.organizationId, inventoryUnits.locationId, inventoryUnits.vehicleId, inventoryUnits.id], name: "inventory_unit_media_exact_unit_fk" }),
  check("inventory_unit_media_id_format", sql`${table.id} ~ '^ima_[a-z0-9_-]{6,64}$'`),
  check("inventory_unit_media_provider_format", sql`${table.provider} ~ '^[a-z0-9][a-z0-9_-]{1,63}$'`),
  check("inventory_unit_media_content_type", sql`${table.contentType} in ('image/jpeg','image/png','image/webp')`),
  check("inventory_unit_media_delivery_url", sql`${table.deliveryUrl} ~ '^https://[^[:space:]]+$'`),
  check("inventory_unit_media_sha256", sql`${table.sha256} ~ '^[a-f0-9]{64}$'`),
  check("inventory_unit_media_dimensions", sql`${table.byteSize} between 1 and 52428800 and ${table.width} between 1 and 20000 and ${table.height} between 1 and 20000`),
  check("inventory_unit_media_alt_text", sql`length(trim(${table.altText})) between 1 and 300`),
  check("inventory_unit_media_source_type", sql`${table.sourceType} in ('actual','cgi-reference','oem-reference')`),
  check("inventory_unit_media_media_type", sql`${table.mediaType} = 'image'`),
  check("inventory_unit_media_original_filename", sql`${table.originalFilename} is null or length(trim(${table.originalFilename})) between 1 and 255`),
  check("inventory_unit_media_sort_order", sql`${table.sortOrder} between 0 and 1000`),
  check("inventory_unit_media_status", sql`${table.status} in ('active','removed')`),
  check("inventory_unit_media_removal_consistency", sql`(${table.status}='removed')=(${table.removedAt} is not null and ${table.removedBy} is not null and ${table.removalReason} is not null)`),
  check("inventory_unit_media_removal_reason", sql`${table.removalReason} is null or length(trim(${table.removalReason})) between 1 and 500`),
]);

export const inventoryMediaUploads = pgTable("inventory_media_uploads", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  locationId: text("location_id").notNull(),
  vehicleId: text("vehicle_id").notNull(),
  inventoryUnitId: text("inventory_unit_id").notNull(),
  objectKey: text("object_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  contentType: text("content_type").notNull(),
  expectedByteSize: integer("expected_byte_size").notNull(),
  altText: text("alt_text").notNull(),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  mediaId: text("media_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  initiatedBy: text("initiated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
}, (table) => [
  uniqueIndex("inventory_media_uploads_organization_id_unique").on(table.organizationId, table.id),
  uniqueIndex("inventory_media_uploads_object_key_unique").on(table.objectKey),
  uniqueIndex("inventory_media_uploads_idempotency_unique").on(table.organizationId, table.idempotencyKey),
  index("inventory_media_uploads_pending_idx").on(table.organizationId, table.inventoryUnitId, table.status, table.expiresAt),
  foreignKey({ columns: [table.organizationId, table.locationId, table.vehicleId, table.inventoryUnitId], foreignColumns: [inventoryUnits.organizationId, inventoryUnits.locationId, inventoryUnits.vehicleId, inventoryUnits.id], name: "inventory_media_uploads_exact_unit_fk" }),
  foreignKey({ columns: [table.organizationId, table.mediaId], foreignColumns: [inventoryUnitMedia.organizationId, inventoryUnitMedia.id], name: "inventory_media_uploads_same_media_fk" }),
  check("inventory_media_uploads_id_format", sql`${table.id} ~ '^imu_[a-z0-9_-]{6,64}$'`),
  check("inventory_media_uploads_object_key", sql`${table.objectKey} ~ '^organizations/org_[a-z0-9_-]{6,64}/inventory/inv_[a-z0-9_-]{6,64}/[a-z0-9_-]{16,80}\\.(jpg|png|webp)$'`),
  check("inventory_media_uploads_filename", sql`length(trim(${table.originalFilename})) between 1 and 255`),
  check("inventory_media_uploads_content_type", sql`${table.contentType} in ('image/jpeg','image/png','image/webp')`),
  check("inventory_media_uploads_byte_size", sql`${table.expectedByteSize} between 1 and 20971520`),
  check("inventory_media_uploads_alt_text", sql`length(trim(${table.altText})) between 1 and 300`),
  check("inventory_media_uploads_status", sql`${table.status} in ('pending','completed','expired','failed')`),
  check("inventory_media_uploads_completion", sql`(${table.status}='completed')=(${table.completedAt} is not null and ${table.mediaId} is not null)`),
  check("inventory_media_uploads_expiry", sql`${table.expiresAt}>${table.createdAt}`),
]);

export const leadVehicleInterests = pgTable(
  "lead_vehicle_interests",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    customerId: text("customer_id").notNull(),
    leadId: text("lead_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    role: vehicleInterestRoleEnum("role").notNull(),
    status: vehicleInterestStatusEnum("status").default("active").notNull(),
    priority: integer("priority").default(0).notNull(),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vehicle_interests_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("vehicle_interests_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("vehicle_interests_active_role_unique").on(table.organizationId, table.leadId, table.role, table.priority).where(sql`${table.status} = 'active'`),
    index("vehicle_interests_customer_idx").on(table.organizationId, table.customerId, table.status),
    foreignKey({ columns: [table.organizationId, table.customerId, table.leadId], foreignColumns: [leads.organizationId, leads.customerId, leads.id], name: "vehicle_interests_same_lead_customer_fk" }),
    foreignKey({ columns: [table.organizationId, table.vehicleId], foreignColumns: [vehicles.organizationId, vehicles.id], name: "vehicle_interests_same_organization_vehicle_fk" }),
    check("vehicle_interests_id_format", sql`${table.id} ~ '^vhi_[a-z0-9_-]{6,64}$'`),
    check("vehicle_interests_priority_nonnegative", sql`${table.priority} >= 0`),
    check("vehicle_interests_notes_length", sql`${table.notes} is null or char_length(${table.notes}) <= 1000`),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), locationId: text("location_id").notNull(),
    customerId: text("customer_id").notNull(), leadId: text("lead_id").notNull(), primaryVehicleId: text("primary_vehicle_id").notNull(),
    inventoryUnitId: text("inventory_unit_id"), ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    dealNumber: text("deal_number").notNull(), status: dealStatusEnum("status").default("draft").notNull(),
    purchaseType: purchaseTypeEnum("purchase_type"), agreedPriceCents: integer("agreed_price_cents"),
    idempotencyKey: text("idempotency_key").notNull(), createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }), ...timestamps,
  },
  (table) => [
    uniqueIndex("deals_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("deals_organization_location_id_unique").on(table.organizationId, table.locationId, table.id),
    uniqueIndex("deals_organization_number_unique").on(table.organizationId, table.dealNumber),
    uniqueIndex("deals_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("deals_buying_cycle_unique").on(table.organizationId, table.leadId).where(sql`${table.status} <> 'cancelled'`),
    index("deals_customer_status_idx").on(table.organizationId, table.customerId, table.status),
    index("deals_lead_idx").on(table.organizationId, table.leadId),
    foreignKey({ columns: [table.organizationId, table.locationId], foreignColumns: [locations.organizationId, locations.id], name: "deals_same_organization_location_fk" }),
    foreignKey({ columns: [table.organizationId, table.customerId, table.leadId], foreignColumns: [leads.organizationId, leads.customerId, leads.id], name: "deals_same_lead_customer_fk" }),
    foreignKey({ columns: [table.organizationId, table.primaryVehicleId], foreignColumns: [vehicles.organizationId, vehicles.id], name: "deals_same_organization_vehicle_fk" }),
    foreignKey({ columns: [table.organizationId, table.locationId, table.primaryVehicleId, table.inventoryUnitId], foreignColumns: [inventoryUnits.organizationId, inventoryUnits.locationId, inventoryUnits.vehicleId, inventoryUnits.id], name: "deals_inventory_matches_location_vehicle_fk" }),
    check("deals_id_format", sql`${table.id} ~ '^dea_[a-z0-9_-]{6,64}$'`),
    check("deals_number_format", sql`${table.dealNumber} ~ '^DF-[A-Z0-9]{8}$'`),
    check("deals_price_nonnegative", sql`${table.agreedPriceCents} is null or ${table.agreedPriceCents} >= 0`),
  ],
);

export const dealStatusEvents = pgTable(
  "deal_status_events",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), dealId: text("deal_id").notNull(),
    fromStatus: dealStatusEnum("from_status"), toStatus: dealStatusEnum("to_status").notNull(), reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("deal_status_events_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("deal_status_events_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("deal_status_events_deal_time_idx").on(table.organizationId, table.dealId, table.occurredAt),
    foreignKey({ columns: [table.organizationId, table.dealId], foreignColumns: [deals.organizationId, deals.id], name: "deal_status_events_same_organization_deal_fk" }),
    check("deal_status_events_id_format", sql`${table.id} ~ '^dst_[a-z0-9_-]{6,64}$'`),
    check("deal_status_events_changed", sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`),
    check("deal_status_events_reason_length", sql`${table.reason} is null or char_length(${table.reason}) <= 1000`),
  ],
);

export const dealQuotes = pgTable(
  "deal_quotes",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), dealId: text("deal_id").notNull(),
    version: integer("version").notNull(), status: quoteStatusEnum("status").default("draft").notNull(),
    purchaseType: purchaseTypeEnum("purchase_type").notNull(),
    currency: text("currency").default("USD").notNull(), subtotalCents: integer("subtotal_cents").notNull(),
    feeCents: integer("fee_cents").notNull(), taxCents: integer("tax_cents").notNull(), discountCents: integer("discount_cents").notNull(),
    totalCents: integer("total_cents").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }),
    presentedAt: timestamp("presented_at", { withTimezone: true }), acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(), createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }), ...timestamps,
  },
  (table) => [
    uniqueIndex("deal_quotes_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("deal_quotes_deal_version_unique").on(table.organizationId, table.dealId, table.version),
    uniqueIndex("deal_quotes_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("deal_quotes_one_accepted_unique").on(table.organizationId, table.dealId).where(sql`${table.status} = 'accepted'`),
    index("deal_quotes_deal_status_idx").on(table.organizationId, table.dealId, table.status),
    foreignKey({ columns: [table.organizationId, table.dealId], foreignColumns: [deals.organizationId, deals.id], name: "deal_quotes_same_organization_deal_fk" }),
    check("deal_quotes_id_format", sql`${table.id} ~ '^quo_[a-z0-9_-]{6,64}$'`),
    check("deal_quotes_version_positive", sql`${table.version} > 0`),
    check("deal_quotes_currency_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("deal_quotes_totals_consistent", sql`${table.totalCents} = ${table.subtotalCents} + ${table.feeCents} + ${table.taxCents} + ${table.discountCents}`),
    check("deal_quotes_nonnegative_total", sql`${table.subtotalCents} >= 0 and ${table.feeCents} >= 0 and ${table.taxCents} >= 0 and ${table.discountCents} <= 0 and ${table.totalCents} >= 0`),
  ],
);

export const dealQuoteLines = pgTable(
  "deal_quote_lines",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), quoteId: text("quote_id").notNull(),
    position: integer("position").notNull(), category: quoteLineCategoryEnum("category").notNull(), description: text("description").notNull(),
    quantity: integer("quantity").default(1).notNull(), unitAmountCents: integer("unit_amount_cents").notNull(), totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("deal_quote_lines_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("deal_quote_lines_quote_position_unique").on(table.organizationId, table.quoteId, table.position),
    foreignKey({ columns: [table.organizationId, table.quoteId], foreignColumns: [dealQuotes.organizationId, dealQuotes.id], name: "deal_quote_lines_same_organization_quote_fk" }),
    check("deal_quote_lines_id_format", sql`${table.id} ~ '^qli_[a-z0-9_-]{6,64}$'`),
    check("deal_quote_lines_position_nonnegative", sql`${table.position} >= 0`),
    check("deal_quote_lines_quantity_positive", sql`${table.quantity} > 0`),
    check("deal_quote_lines_total_consistent", sql`${table.totalCents} = ${table.quantity} * ${table.unitAmountCents}`),
    check("deal_quote_lines_sign", sql`(${table.category} = 'discount' and ${table.unitAmountCents} <= 0) or (${table.category} <> 'discount' and ${table.unitAmountCents} >= 0)`),
    check("deal_quote_lines_description_length", sql`char_length(${table.description}) between 1 and 500`),
  ],
);

export const dealQuoteStatusEvents = pgTable(
  "deal_quote_status_events",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), quoteId: text("quote_id").notNull(),
    fromStatus: quoteStatusEnum("from_status"), toStatus: quoteStatusEnum("to_status").notNull(), reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("quote_status_events_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("quote_status_events_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("quote_status_events_quote_time_idx").on(table.organizationId, table.quoteId, table.occurredAt),
    foreignKey({ columns: [table.organizationId, table.quoteId], foreignColumns: [dealQuotes.organizationId, dealQuotes.id], name: "quote_status_events_same_organization_quote_fk" }),
    check("quote_status_events_id_format", sql`${table.id} ~ '^qst_[a-z0-9_-]{6,64}$'`),
    check("quote_status_events_changed", sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`),
    check("quote_status_events_reason_length", sql`${table.reason} is null or char_length(${table.reason}) <= 1000`),
  ],
);

export const tradeAppraisals = pgTable(
  "trade_appraisals",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), dealId: text("deal_id").notNull(), vehicleId: text("vehicle_id").notNull(),
    version: integer("version").notNull(), status: tradeAppraisalStatusEnum("status").default("draft").notNull(),
    allowanceCents: integer("allowance_cents").notNull(), payoffCents: integer("payoff_cents").notNull(), equityCents: integer("equity_cents").notNull(),
    odometerMiles: integer("odometer_miles"), conditionNotes: text("condition_notes"), lienholder: text("lienholder"),
    expiresAt: timestamp("expires_at", { withTimezone: true }), acquiredInventoryUnitId: text("acquired_inventory_unit_id"),
    idempotencyKey: text("idempotency_key").notNull(), createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }), ...timestamps,
  },
  (table) => [
    uniqueIndex("trade_appraisals_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("trade_appraisals_deal_vehicle_version_unique").on(table.organizationId, table.dealId, table.vehicleId, table.version),
    uniqueIndex("trade_appraisals_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("trade_appraisals_one_accepted_unique").on(table.organizationId, table.dealId, table.vehicleId).where(sql`${table.status} in ('accepted','acquired')`),
    foreignKey({ columns: [table.organizationId, table.dealId], foreignColumns: [deals.organizationId, deals.id], name: "trade_appraisals_same_organization_deal_fk" }),
    foreignKey({ columns: [table.organizationId, table.vehicleId], foreignColumns: [vehicles.organizationId, vehicles.id], name: "trade_appraisals_same_organization_vehicle_fk" }),
    foreignKey({ columns: [table.organizationId, table.vehicleId, table.acquiredInventoryUnitId], foreignColumns: [inventoryUnits.organizationId, inventoryUnits.vehicleId, inventoryUnits.id], name: "trade_appraisals_inventory_matches_vehicle_fk" }),
    check("trade_appraisals_id_format", sql`${table.id} ~ '^tap_[a-z0-9_-]{6,64}$'`),
    check("trade_appraisals_version_positive", sql`${table.version} > 0`),
    check("trade_appraisals_equity_consistent", sql`${table.equityCents} = ${table.allowanceCents} - ${table.payoffCents}`),
    check("trade_appraisals_amounts_nonnegative", sql`${table.allowanceCents} >= 0 and ${table.payoffCents} >= 0`),
    check("trade_appraisals_odometer_nonnegative", sql`${table.odometerMiles} is null or ${table.odometerMiles} >= 0`),
    check("trade_appraisals_notes_length", sql`${table.conditionNotes} is null or char_length(${table.conditionNotes}) <= 2000`),
  ],
);

export const tradeAppraisalStatusEvents = pgTable(
  "trade_appraisal_status_events",
  { id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), appraisalId: text("appraisal_id").notNull(),
    fromStatus: tradeAppraisalStatusEnum("from_status"), toStatus: tradeAppraisalStatusEnum("to_status").notNull(), reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }) },
  (table) => [uniqueIndex("trade_status_events_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("trade_status_events_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    foreignKey({ columns: [table.organizationId, table.appraisalId], foreignColumns: [tradeAppraisals.organizationId, tradeAppraisals.id], name: "trade_status_events_same_organization_appraisal_fk" }),
    check("trade_status_events_id_format", sql`${table.id} ~ '^tas_[a-z0-9_-]{6,64}$'`),
    check("trade_status_events_changed", sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`)],
);

export const dealDeliveries = pgTable(
  "deal_deliveries",
  { id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), locationId: text("location_id").notNull(), dealId: text("deal_id").notNull(),
    status: deliveryStatusEnum("status").default("scheduled").notNull(), startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(), timezone: text("timezone").notNull(), notes: text("notes"), completedAt: timestamp("completed_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(), createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }), ...timestamps },
  (table) => [uniqueIndex("deal_deliveries_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("deal_deliveries_deal_unique").on(table.organizationId, table.dealId),
    uniqueIndex("deal_deliveries_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("deal_deliveries_location_start_idx").on(table.organizationId, table.locationId, table.startsAt),
    foreignKey({ columns: [table.organizationId, table.locationId], foreignColumns: [locations.organizationId, locations.id], name: "deal_deliveries_same_organization_location_fk" }),
    foreignKey({ columns: [table.organizationId, table.locationId, table.dealId], foreignColumns: [deals.organizationId, deals.locationId, deals.id], name: "deal_deliveries_same_location_deal_fk" }),
    check("deal_deliveries_id_format", sql`${table.id} ~ '^dlv_[a-z0-9_-]{6,64}$'`),
    check("deal_deliveries_time_order", sql`${table.endsAt} > ${table.startsAt}`),
    check("deal_deliveries_completion_consistent", sql`(${table.status} = 'completed') = (${table.completedAt} is not null)`),
    check("deal_deliveries_notes_length", sql`${table.notes} is null or char_length(${table.notes}) <= 2000`)],
);

export const dealDeliveryStatusEvents = pgTable(
  "deal_delivery_status_events",
  { id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), deliveryId: text("delivery_id").notNull(),
    fromStatus: deliveryStatusEnum("from_status"), toStatus: deliveryStatusEnum("to_status").notNull(), reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }) },
  (table) => [uniqueIndex("delivery_status_events_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("delivery_status_events_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    foreignKey({ columns: [table.organizationId, table.deliveryId], foreignColumns: [dealDeliveries.organizationId, dealDeliveries.id], name: "delivery_status_events_same_organization_delivery_fk" }),
    check("delivery_status_events_id_format", sql`${table.id} ~ '^dse_[a-z0-9_-]{6,64}$'`),
    check("delivery_status_events_changed", sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: text("location_id"),
    customerId: text("customer_id").notNull(),
    leadId: text("lead_id"),
    assignedUserId: text("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    status: appointmentStatusEnum("status").default("scheduled").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("appointments_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("appointments_organization_customer_id_unique").on(table.organizationId,table.customerId,table.id),
    uniqueIndex("appointments_organization_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("appointments_customer_start_idx").on(
      table.organizationId,
      table.customerId,
      table.startsAt,
    ),
    foreignKey({
      columns: [table.organizationId, table.locationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "appointments_same_organization_location_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "appointments_same_organization_customer_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
      name: "appointments_same_organization_lead_fk",
    }),
    check("appointments_time_order", sql`${table.endsAt} > ${table.startsAt}`),
    check("appointments_id_format", sql`${table.id} ~ '^apt_[a-z0-9_-]{6,64}$'`),
  ],
);

export const appointmentStatusEvents=pgTable("appointment_status_events",{id:text("id").primaryKey(),organizationId:text("organization_id").notNull(),appointmentId:text("appointment_id").notNull(),fromStatus:appointmentStatusEnum("from_status"),toStatus:appointmentStatusEnum("to_status").notNull(),reason:text("reason"),occurredAt:timestamp("occurred_at",{withTimezone:true}).defaultNow().notNull(),idempotencyKey:text("idempotency_key").notNull(),createdBy:text("created_by").notNull().references(()=>users.id,{onDelete:"restrict"})},(table)=>[uniqueIndex("appointment_status_events_organization_id_unique").on(table.organizationId,table.id),uniqueIndex("appointment_status_events_idempotency_unique").on(table.organizationId,table.idempotencyKey),index("appointment_status_events_appointment_time_idx").on(table.organizationId,table.appointmentId,table.occurredAt),foreignKey({columns:[table.organizationId,table.appointmentId],foreignColumns:[appointments.organizationId,appointments.id],name:"appointment_status_events_same_appointment_fk"}),check("appointment_status_events_id_format",sql`${table.id} ~ '^ase_[a-z0-9_-]{6,64}$'`),check("appointment_status_events_reason_length",sql`${table.reason} is null or length(trim(${table.reason})) between 1 and 1000`),check("appointment_status_events_status_change",sql`${table.fromStatus} is null or ${table.fromStatus}<>${table.toStatus}`)]);

export const showroomVisits=pgTable("showroom_visits",{
  id:text("id").primaryKey(),organizationId:text("organization_id").notNull(),locationId:text("location_id").notNull(),customerId:text("customer_id").notNull(),leadId:text("lead_id"),appointmentId:text("appointment_id"),assignedUserId:text("assigned_user_id").references(()=>users.id,{onDelete:"set null"}),status:showroomVisitStatusEnum("status").default("checked-in").notNull(),purpose:text("purpose").notNull(),arrivedAt:timestamp("arrived_at",{withTimezone:true}).notNull(),startedAt:timestamp("started_at",{withTimezone:true}),completedAt:timestamp("completed_at",{withTimezone:true}),cancelledAt:timestamp("cancelled_at",{withTimezone:true}),outcome:text("outcome"),notes:text("notes"),idempotencyKey:text("idempotency_key").notNull(),createdBy:text("created_by").notNull().references(()=>users.id,{onDelete:"restrict"}),updatedBy:text("updated_by").notNull().references(()=>users.id,{onDelete:"restrict"}),...timestamps,
},(table)=>[uniqueIndex("showroom_visits_organization_id_unique").on(table.organizationId,table.id),uniqueIndex("showroom_visits_idempotency_unique").on(table.organizationId,table.idempotencyKey),uniqueIndex("showroom_visits_customer_active_unique").on(table.organizationId,table.customerId).where(sql`${table.status} in ('checked-in','active')`),index("showroom_visits_location_arrived_idx").on(table.organizationId,table.locationId,table.arrivedAt),foreignKey({columns:[table.organizationId,table.locationId],foreignColumns:[locations.organizationId,locations.id],name:"showroom_visits_same_location_fk"}),foreignKey({columns:[table.organizationId,table.customerId],foreignColumns:[customers.organizationId,customers.id],name:"showroom_visits_same_customer_fk"}),foreignKey({columns:[table.organizationId,table.customerId,table.leadId],foreignColumns:[leads.organizationId,leads.customerId,leads.id],name:"showroom_visits_same_lead_customer_fk"}),foreignKey({columns:[table.organizationId,table.customerId,table.appointmentId],foreignColumns:[appointments.organizationId,appointments.customerId,appointments.id],name:"showroom_visits_same_appointment_customer_fk"}),check("showroom_visits_id_format",sql`${table.id} ~ '^vis_[a-z0-9_-]{6,64}$'`),check("showroom_visits_purpose_length",sql`length(trim(${table.purpose})) between 1 and 200`),check("showroom_visits_notes_length",sql`${table.notes} is null or length(${table.notes})<=2000`),check("showroom_visits_outcome_length",sql`${table.outcome} is null or length(trim(${table.outcome})) between 1 and 500`),check("showroom_visits_state_times",sql`(${table.status} not in ('active','completed') or ${table.startedAt} is not null) and (${table.status}<>'checked-in' or ${table.startedAt} is null) and (${table.status}='completed')=(${table.completedAt} is not null) and (${table.status}='cancelled')=(${table.cancelledAt} is not null)`),check("showroom_visits_completion_outcome",sql`${table.status}<>'completed' or ${table.outcome} is not null`),check("showroom_visits_time_order",sql`(${table.startedAt} is null or ${table.startedAt}>=${table.arrivedAt}) and (${table.completedAt} is null or ${table.completedAt}>=${table.startedAt}) and (${table.cancelledAt} is null or ${table.cancelledAt}>=${table.arrivedAt})`)]);

export const showroomVisitStatusEvents=pgTable("showroom_visit_status_events",{id:text("id").primaryKey(),organizationId:text("organization_id").notNull(),visitId:text("visit_id").notNull(),fromStatus:showroomVisitStatusEnum("from_status"),toStatus:showroomVisitStatusEnum("to_status").notNull(),reason:text("reason"),occurredAt:timestamp("occurred_at",{withTimezone:true}).defaultNow().notNull(),idempotencyKey:text("idempotency_key").notNull(),createdBy:text("created_by").notNull().references(()=>users.id,{onDelete:"restrict"})},(table)=>[uniqueIndex("showroom_visit_events_organization_id_unique").on(table.organizationId,table.id),uniqueIndex("showroom_visit_events_idempotency_unique").on(table.organizationId,table.idempotencyKey),index("showroom_visit_events_visit_time_idx").on(table.organizationId,table.visitId,table.occurredAt),foreignKey({columns:[table.organizationId,table.visitId],foreignColumns:[showroomVisits.organizationId,showroomVisits.id],name:"showroom_visit_events_same_visit_fk"}),check("showroom_visit_events_id_format",sql`${table.id} ~ '^vse_[a-z0-9_-]{6,64}$'`),check("showroom_visit_events_reason_length",sql`${table.reason} is null or length(trim(${table.reason})) between 1 and 1000`),check("showroom_visit_events_status_change",sql`${table.fromStatus} is null or ${table.fromStatus}<>${table.toStatus}`)]);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: text("location_id"),
    customerId: text("customer_id").notNull(),
    leadId: text("lead_id"),
    appointmentId: text("appointment_id"),
    assignedUserId: text("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: taskStatusEnum("status").default("open").notNull(),
    priority: taskPriorityEnum("priority").default("normal").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tasks_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("tasks_organization_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("tasks_assignee_due_idx").on(
      table.organizationId,
      table.assignedUserId,
      table.dueAt,
    ),
    foreignKey({
      columns: [table.organizationId, table.locationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "tasks_same_organization_location_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "tasks_same_organization_customer_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
      name: "tasks_same_organization_lead_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.appointmentId],
      foreignColumns: [appointments.organizationId, appointments.id],
      name: "tasks_same_organization_appointment_fk",
    }),
    check("tasks_id_format", sql`${table.id} ~ '^tsk_[a-z0-9_-]{6,64}$'`),
    check("tasks_title_length", sql`length(trim(${table.title})) between 1 and 200`),
  ],
);

export const taskStatusEvents = pgTable(
  "task_status_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    taskId: text("task_id").notNull(),
    fromStatus: taskStatusEnum("from_status"),
    toStatus: taskStatusEnum("to_status").notNull(),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("task_status_events_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("task_status_events_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("task_status_events_task_time_idx").on(table.organizationId, table.taskId, table.occurredAt),
    foreignKey({ columns: [table.organizationId, table.taskId], foreignColumns: [tasks.organizationId, tasks.id], name: "task_status_events_same_task_fk" }),
    check("task_status_events_id_format", sql`${table.id} ~ '^tse_[a-z0-9_-]{6,64}$'`),
    check("task_status_events_reason_length", sql`${table.reason} is null or length(trim(${table.reason})) between 1 and 1000`),
    check("task_status_events_status_change", sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`),
  ],
);

export const notifications=pgTable("notifications",{
  id:text("id").primaryKey(),organizationId:text("organization_id").notNull(),locationId:text("location_id"),recipientUserId:text("recipient_user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),kind:text("kind").notNull(),title:text("title").notNull(),body:text("body").notNull(),href:text("href").notNull(),sourceType:text("source_type").notNull(),sourceId:text("source_id").notNull(),dedupeKey:text("dedupe_key").notNull(),readAt:timestamp("read_at",{withTimezone:true}),createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
},table=>[uniqueIndex("notifications_organization_id_unique").on(table.organizationId,table.id),uniqueIndex("notifications_dedupe_unique").on(table.organizationId,table.dedupeKey),index("notifications_recipient_unread_idx").on(table.organizationId,table.recipientUserId,table.createdAt).where(sql`${table.readAt} is null`),foreignKey({columns:[table.organizationId,table.locationId],foreignColumns:[locations.organizationId,locations.id],name:"notifications_same_location_fk"}),check("notifications_id_format",sql`${table.id} ~ '^ntf_[a-z0-9_-]{6,64}$'`),check("notifications_kind",sql`${table.kind} in ('task-assigned','deal-approval')`),check("notifications_content_length",sql`length(trim(${table.title})) between 1 and 200 and length(trim(${table.body})) between 1 and 500`),check("notifications_href_internal",sql`${table.href} like '/organizations/%'`)]);

export const communications = pgTable(
  "communications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    locationId: text("location_id"),
    customerId: text("customer_id").notNull(),
    leadId: text("lead_id"),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    channel: communicationChannelEnum("channel").notNull(),
    direction: communicationDirectionEnum("direction").notNull(),
    status: communicationStatusEnum("status").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    summary: text("summary").notNull(),
    externalMessageId: text("external_message_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communications_organization_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    uniqueIndex("communications_provider_message_unique")
      .on(table.organizationId, table.channel, table.externalMessageId)
      .where(sql`${table.externalMessageId} is not null`),
    index("communications_customer_occurred_idx").on(
      table.organizationId,
      table.customerId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.organizationId, table.locationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "communications_same_organization_location_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "communications_same_organization_customer_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
      name: "communications_same_organization_lead_fk",
    }),
    check("communications_id_format", sql`${table.id} ~ '^com_[a-z0-9_-]{6,64}$'`),
    check("communications_summary_length", sql`char_length(${table.summary}) between 1 and 1000`),
  ],
);

export const integrationAccounts = pgTable(
  "integration_accounts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: text("location_id"),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    credentialReference: text("credential_reference").notNull(),
    webhookKeyHash: text("webhook_key_hash").notNull(),
    publicBaseUrl: text("public_base_url").notNull(),
    defaultFromAddress: text("default_from_address"),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("integration_accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    uniqueIndex("integration_accounts_webhook_key_unique").on(
      table.webhookKeyHash,
    ),
    index("integration_accounts_organization_idx").on(table.organizationId),
    uniqueIndex("integration_accounts_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      columns: [table.organizationId, table.locationId],
      foreignColumns: [locations.organizationId, locations.id],
      name: "integration_accounts_same_organization_location_fk",
    }),
    check("integration_accounts_id_format", sql`${table.id} ~ '^int_[a-z0-9_-]{6,64}$'`),
    check("integration_accounts_provider", sql`${table.provider} in ('twilio')`),
    check("integration_accounts_public_https", sql`${table.publicBaseUrl} ~ '^https://[^/]+(:[0-9]+)?$'`),
    check("integration_accounts_credential_reference", sql`${table.credentialReference} ~ '^[A-Z][A-Z0-9_]{2,63}$'`),
  ],
);

export const integrationEvents = pgTable(
  "integration_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    integrationId: text("integration_id").notNull(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: integrationEventStatusEnum("status").default("pending").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    failureCode: text("failure_code"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("integration_events_provider_event_unique").on(
      table.organizationId,
      table.provider,
      table.providerEventId,
      table.eventType,
    ),
    index("integration_events_status_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.organizationId, table.integrationId],
      foreignColumns: [integrationAccounts.organizationId, integrationAccounts.id],
      name: "integration_events_same_organization_integration_fk",
    }),
    check("integration_events_id_format", sql`${table.id} ~ '^evt_[a-z0-9_-]{6,64}$'`),
  ],
);

export const communicationConsentEvents = pgTable(
  "communication_consent_events",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
    locationId: text("location_id"), customerId: text("customer_id").notNull(),
    channel: communicationChannelEnum("channel").notNull(), purpose: consentPurposeEnum("purpose").notNull(),
    address: text("address").notNull(), action: consentActionEnum("action").notNull(),
    basis: consentBasisEnum("basis").notNull(), evidenceReference: text("evidence_reference").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("consent_events_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("consent_events_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("consent_events_effective_idx").on(table.organizationId, table.customerId, table.channel, table.purpose, table.address, table.occurredAt),
    foreignKey({ columns: [table.organizationId, table.locationId], foreignColumns: [locations.organizationId, locations.id], name: "consent_events_same_organization_location_fk" }),
    foreignKey({ columns: [table.organizationId, table.customerId], foreignColumns: [customers.organizationId, customers.id], name: "consent_events_same_organization_customer_fk" }),
    check("consent_events_id_format", sql`${table.id} ~ '^cns_[a-z0-9_-]{6,64}$'`),
    check("consent_events_basis_action", sql`(${table.action} = 'revoked' AND ${table.basis} = 'not-applicable') OR (${table.action} = 'granted' AND ${table.basis} <> 'not-applicable')`),
  ],
);

export const communicationSendAttempts = pgTable(
  "communication_send_attempts",
  {
    id: text("id").primaryKey(), organizationId: text("organization_id").notNull(),
    locationId: text("location_id"), customerId: text("customer_id").notNull(), leadId: text("lead_id"),
    integrationId: text("integration_id").notNull(), consentEventId: text("consent_event_id").notNull(),
    channel: communicationChannelEnum("channel").notNull(), purpose: consentPurposeEnum("purpose").notNull(),
    destination: text("destination").notNull(), body: text("body").notNull(),
    status: sendAttemptStatusEnum("status").default("queued").notNull(),
    notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
    providerMessageId: text("provider_message_id"), providerStatus: text("provider_status"),
    failureCode: text("failure_code"), resolutionEvidenceReference: text("resolution_evidence_reference"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestedBy: text("requested_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("send_attempts_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("send_attempts_organization_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    uniqueIndex("send_attempts_provider_message_unique").on(table.organizationId, table.providerMessageId).where(sql`${table.providerMessageId} is not null`),
    index("send_attempts_dispatch_idx").on(table.organizationId, table.status, table.notBefore),
    foreignKey({ columns: [table.organizationId, table.locationId], foreignColumns: [locations.organizationId, locations.id], name: "send_attempts_same_organization_location_fk" }),
    foreignKey({ columns: [table.organizationId, table.customerId], foreignColumns: [customers.organizationId, customers.id], name: "send_attempts_same_organization_customer_fk" }),
    foreignKey({ columns: [table.organizationId, table.leadId], foreignColumns: [leads.organizationId, leads.id], name: "send_attempts_same_organization_lead_fk" }),
    foreignKey({ columns: [table.organizationId, table.integrationId], foreignColumns: [integrationAccounts.organizationId, integrationAccounts.id], name: "send_attempts_same_organization_integration_fk" }),
    foreignKey({ columns: [table.organizationId, table.consentEventId], foreignColumns: [communicationConsentEvents.organizationId, communicationConsentEvents.id], name: "send_attempts_same_organization_consent_fk" }),
    check("send_attempts_id_format", sql`${table.id} ~ '^snd_[a-z0-9_-]{6,64}$'`),
    check("send_attempts_body_length", sql`char_length(${table.body}) between 1 and 1600`),
    check("send_attempts_resolution_consistent", sql`(${table.resolutionEvidenceReference} is null) = (${table.resolvedAt} is null)`),
  ],
);

export const externalRecordMappings = pgTable(
  "external_record_mappings",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    sourceBaseId: text("source_base_id"),
    sourceTableId: text("source_table_id"),
    sourceRecordId: text("source_record_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    sourceModifiedAt: timestamp("source_modified_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("external_record_mappings_source_unique").on(
      table.provider,
      table.sourceBaseId,
      table.sourceTableId,
      table.sourceRecordId,
    ),
    uniqueIndex("external_record_mappings_entity_unique").on(
      table.organizationId,
      table.provider,
      table.entityType,
      table.entityId,
    ),
    index("external_record_mappings_organization_idx").on(table.organizationId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    source: text("source").notNull(),
    correlationId: text("correlation_id").notNull(),
    oldValues: jsonb("old_values").$type<Record<string, unknown>>(),
    newValues: jsonb("new_values").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_correlation_idx").on(table.correlationId),
    check("audit_logs_id_format", sql`${table.id} ~ '^aud_[a-z0-9_-]{6,64}$'`),
  ],
);

export const productUsageEvents = pgTable(
  "product_usage_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    locationId: text("location_id"),
    eventName: text("event_name").notNull(),
    actorType: text("actor_type").notNull(),
    dataClass: text("data_class").notNull(),
    workspace: text("workspace").notNull(),
    feature: text("feature").notNull(),
    action: text("action").notNull(),
    roleKey: text("role_key"),
    release: text("release").notNull(),
    deviceClass: text("device_class").notNull(),
    requestId: text("request_id"),
    featureFlags: jsonb("feature_flags").$type<Record<string, boolean>>().default({}).notNull(),
    attributes: jsonb("attributes").$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("product_usage_events_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("product_usage_events_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("product_usage_events_tenant_time_idx").on(table.organizationId, table.occurredAt),
    index("product_usage_events_release_idx").on(table.organizationId, table.release, table.occurredAt),
    foreignKey({ columns: [table.organizationId, table.locationId], foreignColumns: [locations.organizationId, locations.id], name: "product_usage_events_same_location_fk" }),
    check("product_usage_events_id_format", sql`${table.id} ~ '^pue_[a-z0-9_-]{6,64}$'`),
    check("product_usage_events_name", sql`${table.eventName} ~ '^[a-z][a-z0-9-]{1,39}\.[a-z][a-z0-9-]{1,39}$'`),
    check("product_usage_events_actor_type", sql`${table.actorType} in ('dealer-user','dealerflow-staff','automation','synthetic')`),
    check("product_usage_events_data_class", sql`${table.dataClass} in ('demo','pilot','production')`),
    check("product_usage_events_device_class", sql`${table.deviceClass} in ('desktop','tablet','mobile','server')`),
  ],
);

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  domain: text("domain").notNull(), sourceName: text("source_name").notNull(), sourceChecksum: text("source_checksum").notNull(),
  mapping: jsonb("mapping").$type<Record<string, string>>().notNull(), status: text("status").notNull(),
  totalRows: integer("total_rows").notNull(), validRows: integer("valid_rows").notNull(), rejectedRows: integer("rejected_rows").notNull(),
  duplicateRows: integer("duplicate_rows").notNull(), unresolvedRows: integer("unresolved_rows").notNull(),
  idempotencyKey: text("idempotency_key").notNull(), createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("import_batches_organization_id_unique").on(table.organizationId, table.id),
  uniqueIndex("import_batches_idempotency_unique").on(table.organizationId, table.idempotencyKey),
  index("import_batches_status_idx").on(table.organizationId, table.status, table.createdAt),
  check("import_batches_id_format", sql`${table.id} ~ '^imb_[a-z0-9_-]{6,64}$'`),
  check("import_batches_domain", sql`${table.domain} in ('customer-lead','inventory','user')`),
  check("import_batches_status", sql`${table.status} in ('review-required','ready','completed','failed','aborted')`),
  check("import_batches_checksum", sql`${table.sourceChecksum} ~ '^[a-f0-9]{64}$'`),
  check("import_batches_source_name_length", sql`char_length(trim(${table.sourceName})) between 1 and 255`),
  check("import_batches_idempotency_length", sql`char_length(trim(${table.idempotencyKey})) between 1 and 200`),
  check("import_batches_counts", sql`${table.totalRows} between 1 and 10000 and ${table.validRows} >= 0 and ${table.rejectedRows} >= 0 and ${table.duplicateRows} >= 0 and ${table.unresolvedRows} >= 0 and ${table.validRows}+${table.rejectedRows}+${table.duplicateRows}+${table.unresolvedRows}=${table.totalRows}`),
]);

export const importBatchRows = pgTable("import_batch_rows", {
  id: text("id").primaryKey(), organizationId: text("organization_id").notNull(), batchId: text("batch_id").notNull(),
  rowNumber: integer("row_number").notNull(), status: text("status").notNull(),
  canonical: jsonb("canonical").$type<Record<string, string | number | boolean>>().notNull(),
  issues: jsonb("issues").$type<readonly Record<string, unknown>[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("import_batch_rows_organization_id_unique").on(table.organizationId, table.id),
  uniqueIndex("import_batch_rows_number_unique").on(table.organizationId, table.batchId, table.rowNumber),
  foreignKey({ columns: [table.organizationId, table.batchId], foreignColumns: [importBatches.organizationId, importBatches.id], name: "import_batch_rows_same_batch_fk" }),
  check("import_batch_rows_id_format", sql`${table.id} ~ '^imr_[a-z0-9_-]{6,64}$'`),
  check("import_batch_rows_number", sql`${table.rowNumber} between 1 and 10000`),
  check("import_batch_rows_status", sql`${table.status} in ('valid','rejected','duplicate','needs-review')`),
]);
