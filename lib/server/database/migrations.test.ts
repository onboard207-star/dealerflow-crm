import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "drizzle");

describe("tenant database migrations", () => {
  it("journals every checked-in SQL migration exactly once in execution order",()=>{const files=readdirSync(migrationDirectory).filter(name=>/^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort().map(name=>name.slice(0,-4));const journal=JSON.parse(readFileSync(join(migrationDirectory,"meta/_journal.json"),"utf8"))as{entries:Array<{idx:number;when:number;tag:string}>};expect(journal.entries.map(entry=>entry.tag)).toEqual(files);expect(journal.entries.map(entry=>entry.idx)).toEqual(files.map((_,index)=>index));expect(new Set(journal.entries.map(entry=>entry.when)).size).toBe(files.length);for(let index=1;index<journal.entries.length;index+=1)expect(journal.entries[index]!.when).toBeGreaterThan(journal.entries[index-1]!.when);});
  it("adds tenant-isolated, expiring staff invitations and bounded operations", () => {
    const invitations = readFileSync(join(migrationDirectory, "0017_organization_invitations.sql"), "utf8");
    const operations = readFileSync(join(migrationDirectory, "0018_invitation_operations.sql"), "utf8");
    for (const table of ["organization_invitations", "organization_invitation_roles", "organization_invitation_locations"]) expect(invitations).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    expect(invitations).toContain("organization_invitations_pending_email_unique");
    expect(invitations).toContain("organization_invitations_recipient_accept");
    expect(invitations).toContain("email_verified");
    expect(operations).toContain("organization_invitations_resend_limit");
    expect(operations).toContain("organization_invitations_rate_limit_idx");
  });
  it("links invitation email delivery to its tenant without tenant-tagging account email", () => {
    const migration=readFileSync(join(migrationDirectory,"0019_transactional_email_observability.sql"),"utf8");
    expect(migration).toContain("transactional_email_same_org_invitation_fk");
    expect(migration).toContain("transactional_email_invitation_scope");
    expect(migration).toContain("transactional_email_invitation_idx");
  });
  it("adds tenant-isolated, immutable and reviewable AI recommendation runs",()=>{const migration=readFileSync(join(migrationDirectory,"0020_ai_recommendations.sql"),"utf8");expect(migration).toContain("ai_runs_same_customer_lead_fk");expect(migration).toContain("ai_runs_customer_pending_unique");expect(migration).toContain("ai_runs_actor_rate_limit_idx");expect(migration).toContain('ALTER TABLE "ai_recommendation_runs" FORCE ROW LEVEL SECURITY');expect(migration).toContain("prevent_ai_run_authority_rewrite");});
  it("adds immutable tenant configuration snapshots and same-tenant rollback links",()=>{const migration=readFileSync(join(migrationDirectory,"0021_tenant_configuration_history.sql"),"utf8");expect(migration).toContain("configuration_versions_same_org_restore_fk");expect(migration).toContain('ALTER TABLE "organization_configuration_versions" FORCE ROW LEVEL SECURITY');expect(migration).toContain("prevent_configuration_version_mutation");expect(migration).toContain("configuration_versions_restore_consistency");});
  it("adds tenant-isolated showroom visits with immutable status history",()=>{const migration=readFileSync(join(migrationDirectory,"0022_showroom_visits.sql"),"utf8");expect(migration).toContain("showroom_visits_same_lead_customer_fk");expect(migration).toContain("showroom_visits_same_appointment_customer_fk");expect(migration).toContain("showroom_visits_customer_active_unique");expect(migration).toContain("showroom_visit_events_status_change");expect(migration).toContain('ALTER TABLE "showroom_visits" FORCE ROW LEVEL SECURITY');expect(migration).toContain('ALTER TABLE "showroom_visit_status_events" FORCE ROW LEVEL SECURITY');expect(migration).toContain("prevent_showroom_visit_authority_rewrite");expect(migration).not.toMatch(/CREATE POLICY "showroom_visit_events.*FOR (ALL|UPDATE|DELETE)/);});
  it("allows only one non-cancelled Deal per Lead buying cycle",()=>{const migration=readFileSync(join(migrationDirectory,"0023_deal_buying_cycle_integrity.sql"),"utf8");expect(migration).toContain("deals_buying_cycle_unique");expect(migration).toContain("WHERE \"status\" <> 'cancelled'");});
  it("adds tenant-isolated immutable task lifecycle evidence",()=>{const migration=readFileSync(join(migrationDirectory,"0024_task_lifecycle.sql"),"utf8");expect(migration).toContain("task_status_events_same_task_fk");expect(migration).toContain("task_status_events_idempotency_unique");expect(migration).toContain('ALTER TABLE "task_status_events" FORCE ROW LEVEL SECURITY');expect(migration).toContain("prevent_task_authority_rewrite");expect(migration).not.toMatch(/CREATE POLICY "task_status_events.*FOR (ALL|UPDATE|DELETE)/);});
  it("adds tenant-isolated immutable appointment lifecycle evidence",()=>{const migration=readFileSync(join(migrationDirectory,"0025_appointment_lifecycle.sql"),"utf8");expect(migration).toContain("appointment_status_events_same_appointment_fk");expect(migration).toContain("appointment_status_events_idempotency_unique");expect(migration).toContain('ALTER TABLE "appointment_status_events" FORCE ROW LEVEL SECURITY');expect(migration).toContain("prevent_appointment_authority_rewrite");expect(migration).not.toMatch(/CREATE POLICY "appointment_status_events.*FOR (ALL|UPDATE|DELETE)/);});
  it("adds tenant-isolated immutable Lead lifecycle evidence",()=>{const migration=readFileSync(join(migrationDirectory,"0026_lead_lifecycle.sql"),"utf8");expect(migration).toContain("lead_status_events_same_lead_fk");expect(migration).toContain("lead_status_events_idempotency_unique");expect(migration).toContain("leads_lost_reason_consistent");expect(migration).toContain('ALTER TABLE "lead_status_events" FORCE ROW LEVEL SECURITY');expect(migration).toContain("prevent_lead_authority_rewrite");expect(migration).not.toMatch(/CREATE POLICY "lead_status_events.*FOR (ALL|UPDATE|DELETE)/);});
  it("adds tenant-isolated inventory pricing and status evidence",()=>{const migration=readFileSync(join(migrationDirectory,"0027_inventory_lifecycle.sql"),"utf8");expect(migration).toContain("inventory_unit_events_same_inventory_fk");expect(migration).toContain("inventory_unit_events_idempotency_unique");expect(migration).toContain("record_deal_inventory_status_event");expect(migration).toContain("record_trade_inventory_creation_event");expect(migration).toContain('ALTER TABLE "inventory_unit_events" FORCE ROW LEVEL SECURITY');expect(migration).not.toMatch(/CREATE POLICY "inventory_unit_events.*FOR (ALL|UPDATE|DELETE)/);});
  it("adds recipient-isolated durable operational notifications",()=>{const migration=readFileSync(join(migrationDirectory,"0028_notifications.sql"),"utf8");expect(migration).toContain("notifications_recipient_select");expect(migration).toContain("notifications_recipient_update");expect(migration).toContain("prevent_notification_authority_rewrite");expect(migration).toContain("notify_task_assignment");expect(migration).toContain("notify_deal_approval");expect(migration).toContain('ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY');expect(migration).not.toMatch(/CREATE POLICY "notifications.*FOR DELETE/);});
  it("permits only exact invitation-bound signup and constrained operator bootstrap",()=>{const migration=readFileSync(join(migrationDirectory,"0029_invitation_only_signup.sql"),"utf8");expect(migration).toContain("organization_invitations_signup_read");expect(migration).toContain("app.invitation_signup_email");expect(migration).toContain("organization_invitations_operator_insert");expect(migration).toContain("organization_invitations_operator_read");expect(migration).toContain("app.operator_provision");expect(migration).toContain("invited_by\" IS NULL");expect(migration).toContain("operator-provision:%");expect(migration).not.toMatch(/signup_read.*FOR (ALL|UPDATE|DELETE)/);});
  it("allows global identity writes only through the dedicated authentication runtime",()=>{const migration=readFileSync(join(migrationDirectory,"0030_authentication_user_rls.sql"),"utf8");expect(migration).toContain("users_auth_runtime_select");expect(migration).toContain("users_auth_runtime_insert");expect(migration).toContain("users_auth_runtime_update");expect(migration).toContain("app.auth_runtime");expect(migration).not.toContain("FOR DELETE");});
  it("adds exact-unit verified inventory media without mutable authority",()=>{const migration=readFileSync(join(migrationDirectory,"0031_inventory_unit_media.sql"),"utf8");expect(migration).toContain("inventory_unit_media_exact_unit_fk");expect(migration).toContain("inventory_unit_media_provider_asset_unique");expect(migration).toContain("prevent_inventory_media_authority_rewrite");expect(migration).toContain('ALTER TABLE "inventory_unit_media" FORCE ROW LEVEL SECURITY');expect(migration).not.toMatch(/CREATE POLICY "inventory_unit_media.*FOR (ALL|DELETE)/);});
  it("adds bounded exact-unit upload intents with immutable authority",()=>{const migration=readFileSync(join(migrationDirectory,"0032_inventory_media_uploads.sql"),"utf8");expect(migration).toContain("inventory_media_uploads_exact_unit_fk");expect(migration).toContain("inventory_media_uploads_idempotency_unique");expect(migration).toContain("prevent_inventory_upload_authority_rewrite");expect(migration).toContain('ALTER TABLE "inventory_media_uploads" FORCE ROW LEVEL SECURITY');expect(migration).not.toMatch(/CREATE POLICY "inventory_media_uploads.*FOR (ALL|DELETE)/);});
  it("adds explicit media provenance and one active primary image",()=>{const migration=readFileSync(join(migrationDirectory,"0035_inventory_media_provenance.sql"),"utf8");expect(migration).toContain('"source_type"');expect(migration).toContain("'actual','cgi-reference','oem-reference'");expect(migration).toContain("inventory_unit_media_one_primary_active");expect(migration).toContain('"is_primary"=true');});
  it("adds tenant-isolated persistent import staging and immutable row evidence",()=>{const migration=readFileSync(join(migrationDirectory,"0037_persistent_import_staging.sql"),"utf8");expect(migration).toContain("import_batch_rows_same_batch_fk");expect(migration).toContain("import_batches_idempotency_unique");expect(migration).toContain("import_batch_rows_immutable");expect(migration).toContain("prevent_import_batch_authority_rewrite");expect(migration).toContain('ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY');expect(migration).toContain('ALTER TABLE "import_batch_rows" FORCE ROW LEVEL SECURITY');});
  it("adds batch-bounded commit and immutable reversal evidence",()=>{const migration=readFileSync(join(migrationDirectory,"0039_import_commit_reversal.sql"),"utf8");expect(migration).toContain("import_applied_records_same_batch_fk");expect(migration).toContain("import_applied_records_entity_unique");expect(migration).toContain("import_applied_records_immutable");expect(migration).toContain("prevent_import_applied_record_rewrite");expect(migration).toContain("'reversed'");expect(migration).toContain('ALTER TABLE "import_applied_records" FORCE ROW LEVEL SECURITY');});
  it("adds the exact Quote-line key required by incentive and backend snapshot foreign keys",()=>{const migration=readFileSync(join(migrationDirectory,"0045_quote_incentive_provenance.sql"),"utf8");expect(migration).toContain('CREATE UNIQUE INDEX "deal_quote_lines_org_quote_id_unique"');expect(migration).toContain('ON "deal_quote_lines" ("organization_id", "quote_id", "id")');});
  it("adds the exact location-unit key required by profitability and intake foreign keys",()=>{const migration=readFileSync(join(migrationDirectory,"0047_quote_profitability.sql"),"utf8");expect(migration).toContain('CREATE UNIQUE INDEX "inventory_units_org_location_id_unique"');expect(migration).toContain('ON "inventory_units" ("organization_id", "location_id", "id")');});
  it("adds immutable tenant-scoped lead intake orchestration evidence",()=>{const migration=readFileSync(join(migrationDirectory,"0049_lead_intake_orchestration.sql"),"utf8");expect(migration).toContain("lead_intakes_same_lead_fk");expect(migration).toContain("lead_intakes_idempotency_unique");expect(migration).toContain("lead_intakes_source_lead_unique");expect(migration).toContain("prevent_lead_intake_rewrite");expect(migration).toContain('ALTER TABLE "lead_intake_records" FORCE ROW LEVEL SECURITY');expect(migration).not.toMatch(/CREATE POLICY "lead_intakes.*FOR (ALL|UPDATE|DELETE)/);});
  it("links Deals immutably to the canonical appointment and showroom journey",()=>{const migration=readFileSync(join(migrationDirectory,"0050_deal_journey_links.sql"),"utf8");expect(migration).toContain("deals_same_journey_appointment_fk");expect(migration).toContain("deals_same_journey_visit_fk");expect(migration).toContain("deals_visit_requires_appointment");expect(migration).toContain("prevent_deal_journey_rewrite");});
  it("classifies demo tenants and prevents telemetry data-class spoofing",()=>{const migration=readFileSync(join(migrationDirectory,"0038_organization_data_class.sql"),"utf8");expect(migration).toContain("organizations_data_class");expect(migration).toContain("product_usage_events_data_class_authority");expect(migration).toContain("must match organization authority");});
  it("enforces same-organization customer, lead, role, and location relationships", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0001_tenant_relationship_integrity.sql"),
      "utf8",
    );

    expect(migration).toContain("customers_same_organization_location_fk");
    expect(migration).toContain("leads_same_organization_customer_fk");
    expect(migration).toContain("leads_same_organization_location_fk");
    expect(migration).toContain(
      "membership_roles_same_organization_membership_fk",
    );
    expect(migration).toContain("membership_roles_same_organization_role_fk");
  });

  it("forces row-level security on every tenant-owned operational table", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0002_tenant_row_level_security.sql"),
      "utf8",
    );
    const tenantTables = [
      "organizations",
      "organization_configurations",
      "locations",
      "organization_memberships",
      "membership_locations",
      "roles",
      "role_capabilities",
      "membership_roles",
      "customers",
      "leads",
      "external_record_mappings",
      "audit_logs",
    ];

    for (const table of tenantTables) {
      expect(migration).toContain(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
      );
    }
  });

  it("does not grant audit-log update or delete policies", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0002_tenant_row_level_security.sql"),
      "utf8",
    );

    expect(migration).toContain("audit_logs_current_tenant_select");
    expect(migration).toContain("audit_logs_current_tenant_insert");
    expect(migration).not.toMatch(/audit_logs.*FOR UPDATE/);
    expect(migration).not.toMatch(/audit_logs.*FOR DELETE/);
  });

  it("adds the Better Auth session, account, and verification tables", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0003_better_auth.sql"),
      "utf8",
    );

    expect(migration).toContain('CREATE TABLE "auth_sessions"');
    expect(migration).toContain('CREATE TABLE "auth_accounts"');
    expect(migration).toContain('CREATE TABLE "auth_verifications"');
    expect(migration).toContain('REFERENCES "users"("id") ON DELETE CASCADE');
    expect(migration).toContain('"auth_sessions_token_unique"');
    expect(migration).toContain('"auth_accounts_issuer_account_unique"');
  });

  it("adds tenant-isolated appointments and follow-up tasks", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0004_appointment_tasks.sql"),
      "utf8",
    );

    expect(migration).toContain("appointments_same_organization_customer_fk");
    expect(migration).toContain("appointments_same_organization_lead_fk");
    expect(migration).toContain("tasks_same_organization_appointment_fk");
    expect(migration).toContain('ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("appointments_organization_idempotency_unique");
    expect(migration).toContain("tasks_organization_idempotency_unique");
  });

  it("allows authenticated users to discover only active member organizations", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0005_organization_discovery.sql"),
      "utf8",
    );
    expect(migration).toContain("organizations_active_member_select");
    expect(migration).toContain("membership.\"user_id\" = nullif(current_setting('app.user_id'");
    expect(migration).toContain("membership.\"status\" = 'active'");
  });

  it("adds tenant-isolated, idempotent communication history", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0006_communications.sql"),
      "utf8",
    );
    expect(migration).toContain("communications_same_organization_customer_fk");
    expect(migration).toContain("communications_same_organization_lead_fk");
    expect(migration).toContain("communications_organization_idempotency_unique");
    expect(migration).toContain('ALTER TABLE "communications" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("communications_summary_length");
  });

  it("adds bounded customer-name and chronological lead queue indexes", () => {
    const migration = readFileSync(
      join(migrationDirectory, "0007_crm_directory_indexes.sql"),
      "utf8",
    );
    expect(migration).toContain("customers_organization_name_search_idx");
    expect(migration).toContain("text_pattern_ops");
    expect(migration).toContain("leads_organization_created_idx");
  });

  it("adds tenant integration routing and a durable replay-safe event inbox", () => {
    const migration = readFileSync(join(migrationDirectory, "0008_integration_accounts.sql"), "utf8");
    expect(migration).toContain("integration_accounts_same_organization_location_fk");
    expect(migration).toContain("integration_events_provider_event_unique");
    expect(migration).toContain("resolve_twilio_webhook_account");
    expect(migration).toContain("digest(webhook_key, 'sha256')");
    expect(migration).toContain('ALTER TABLE "integration_events" FORCE ROW LEVEL SECURITY');
  });

  it("adds immutable consent history and durable outbound send attempts", () => {
    const migration = readFileSync(join(migrationDirectory, "0009_consent_and_send_attempts.sql"), "utf8");
    expect(migration).toContain("consent_events_basis_action");
    expect(migration).toContain("consent_events_organization_idempotency_unique");
    expect(migration).toContain("send_attempts_same_organization_consent_fk");
    expect(migration).toContain("send_attempts_organization_idempotency_unique");
    expect(migration).toContain('ALTER TABLE "communication_send_attempts" FORCE ROW LEVEL SECURITY');
  });

  it("adds canonical vehicles, location inventory, and lead vehicle interests", () => {
    const migration = readFileSync(join(migrationDirectory, "0010_vehicle_inventory_interests.sql"), "utf8");
    expect(migration).toContain("leads_organization_customer_id_unique");
    expect(migration).toContain("vehicle_interests_same_lead_customer_fk");
    expect(migration).toContain("inventory_units_same_organization_vehicle_fk");
    expect(migration).toContain("vehicles_organization_vin_unique");
    for (const table of ["vehicles", "inventory_units", "lead_vehicle_interests"]) {
      expect(migration).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    }
  });

  it("adds tenant-isolated deals with immutable status history", () => {
    const migration = readFileSync(join(migrationDirectory, "0011_deal_lifecycle.sql"), "utf8");
    expect(migration).toContain("deals_same_lead_customer_fk");
    expect(migration).toContain("deals_inventory_matches_location_vehicle_fk");
    expect(migration).toContain("deal_status_events_organization_idempotency_unique");
    expect(migration).toContain('ALTER TABLE "deals" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "deal_status_events" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("consent_events_current_tenant_insert");
    expect(migration).not.toMatch(/CREATE POLICY "deal_status_events.*FOR ALL/);
  });

  it("adds versioned quotes with immutable line items and status history", () => {
    const migration = readFileSync(join(migrationDirectory, "0012_versioned_quotes.sql"), "utf8");
    expect(migration).toContain("deal_quotes_deal_version_unique");
    expect(migration).toContain("deal_quote_lines_total_consistent");
    expect(migration).toContain("deal_quotes_totals_consistent");
    expect(migration).toContain("deal_quote_lines_current_tenant_insert");
    expect(migration).not.toMatch(/CREATE POLICY "deal_quote_lines.*FOR ALL/);
    expect(migration).not.toMatch(/CREATE POLICY "quote_status_events.*FOR ALL/);
  });

  it("adds immutable trade appraisals and delivery handoff records", () => {
    const migration = readFileSync(join(migrationDirectory, "0013_trade_delivery.sql"), "utf8");
    expect(migration).toContain("trade_appraisals_equity_consistent");
    expect(migration).toContain("trade_appraisals_inventory_matches_vehicle_fk");
    expect(migration).toContain("trade_appraisals_immutable_financials");
    expect(migration).toContain("deal_deliveries_completion_consistent");
    expect(migration).toContain("deal_deliveries_same_location_deal_fk");
    expect(migration).toContain("delivery_status_events_current_tenant_insert");
  });

  it("adds bounded due-message discovery without bypassing tenant mutations", () => {
    const migration = readFileSync(join(migrationDirectory, "0014_outbound_job_discovery.sql"), "utf8");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("batch_limit > 100");
    expect(migration).toContain("attempt.status = 'queued'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION");
    expect(migration).not.toContain("UPDATE communication_send_attempts");
  });

  it("adds auditable manual resolution evidence for ambiguous sends", () => {
    const migration = readFileSync(join(migrationDirectory, "0015_outbound_reconciliation.sql"), "utf8");
    expect(migration).toContain("resolution_evidence_reference");
    expect(migration).toContain("send_attempts_resolution_consistent");
    expect(migration).toContain("send_attempts_reconciliation_idx");
  });

  it("authorizes cross-recipient notifications without exposing membership rows", () => {
    const migration = readFileSync(join(migrationDirectory, "0033_notification_recipient_authorization.sql"), "utf8");
    expect(migration).toContain("notification_recipient_is_active");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog");
    expect(migration).toContain("REVOKE ALL ON FUNCTION");
    expect(migration).toContain('DROP POLICY "notifications_tenant_insert"');
    expect(migration).toContain('CREATE POLICY "notifications_tenant_insert"');
    expect(migration).toContain("public.organization_memberships");
    expect(migration).toContain("public.membership_locations");
  });

  it("deduplicates notification triggers without conflict reads across recipient RLS", () => {
    const migration = readFileSync(join(migrationDirectory, "0034_notification_trigger_deduplication.sql"), "utf8");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION notify_task_assignment");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION notify_deal_approval");
    expect(migration).toContain("EXCEPTION WHEN unique_violation");
    expect(migration).toContain("notification_recipient_is_active");
    expect(migration).not.toContain("ON CONFLICT");
  });

  it("adds forced tenant isolation and explicit exclusion dimensions for product telemetry", () => {
    const migration = readFileSync(join(migrationDirectory, "0036_governed_product_telemetry.sql"), "utf8");
    expect(migration).toContain('ALTER TABLE "product_usage_events" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('"actor_type" in (\'dealer-user\',\'dealerflow-staff\',\'automation\',\'synthetic\')');
    expect(migration).toContain('"data_class" in (\'demo\',\'pilot\',\'production\')');
    expect(migration).toContain('current_setting(\'app.organization_id\', true)');
  });

  it("restricts synthetic lifecycle deletion to a dedicated, versioned demo-reset role", () => {
    const migration = readFileSync(join(migrationDirectory, "0040_synthetic_reset_maintenance_role.sql"), "utf8");
    expect(migration).toContain("dealerflow_synthetic_reset_executor NOLOGIN");
    expect(migration).toContain("NOBYPASSRLS");
    expect(migration).toContain('FOR DELETE\nTO dealerflow_synthetic_reset_executor');
    expect(migration).toContain("organization_id = 'org_demo_first_pilot_v1'");
    expect(migration).toContain("app.synthetic_fixture_version");
    expect(migration.match(/nullif\(current_setting\('app\.synthetic_fixture_version', true\), ''\) = 'pilot-demo-v1'/g)).toHaveLength(2);
    expect(migration).not.toContain("= 'v1'");
    expect(migration).toContain("= 'pilot-demo-v1'");
    expect(migration).toContain("organization.data_class = 'demo'");
    expect(migration).toContain("pg_has_role(session_user");
    expect(migration).not.toMatch(/FOR DELETE\s+TO (PUBLIC|CURRENT_USER)/);
    expect(migration).not.toMatch(/GRANT dealerflow_synthetic_reset_executor TO (PUBLIC|CURRENT_USER)/);
    expect(migration.match(/CREATE POLICY/g)).toHaveLength(2);
  });
});
