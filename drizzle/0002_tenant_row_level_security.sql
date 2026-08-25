-- DealerFlow tenant isolation is enforced with transaction-local PostgreSQL settings.
-- Application transactions must call:
--   select set_config('app.user_id', '<verified-user-id>', true);
--   select set_config('app.organization_id', '<authorized-org-id>', true);
-- The final argument MUST remain true so pooled connections cannot leak tenant context.

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "organizations_current_tenant" ON "organizations"
  USING ("id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "organization_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_configurations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "organization_configurations_current_tenant" ON "organization_configurations"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "locations_current_tenant" ON "locations"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "users_self_or_current_tenant_members" ON "users" FOR SELECT
  USING (
    "id" = nullif(current_setting('app.user_id', true), '')
    OR EXISTS (
      SELECT 1
      FROM "organization_memberships" membership
      WHERE membership."user_id" = "users"."id"
        AND membership."organization_id" = nullif(current_setting('app.organization_id', true), '')
        AND membership."status" = 'active'
    )
  );
CREATE POLICY "users_self_update" ON "users" FOR UPDATE
  USING ("id" = nullif(current_setting('app.user_id', true), ''))
  WITH CHECK ("id" = nullif(current_setting('app.user_id', true), ''));

ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "organization_memberships_self_or_current_tenant" ON "organization_memberships" FOR SELECT
  USING (
    "user_id" = nullif(current_setting('app.user_id', true), '')
    OR "organization_id" = nullif(current_setting('app.organization_id', true), '')
  );
CREATE POLICY "organization_memberships_current_tenant_write" ON "organization_memberships"
  FOR ALL
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "membership_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "membership_locations_current_tenant" ON "membership_locations"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "roles_current_tenant" ON "roles"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "role_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_capabilities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "role_capabilities_current_tenant" ON "role_capabilities"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "membership_roles_current_tenant" ON "membership_roles"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customers_current_tenant" ON "customers"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
CREATE POLICY "leads_current_tenant" ON "leads"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "external_record_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_record_mappings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "external_record_mappings_current_tenant" ON "external_record_mappings"
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_current_tenant_select" ON "audit_logs" FOR SELECT
  USING ("organization_id" = nullif(current_setting('app.organization_id', true), ''));
CREATE POLICY "audit_logs_current_tenant_insert" ON "audit_logs" FOR INSERT
  WITH CHECK ("organization_id" = nullif(current_setting('app.organization_id', true), ''));
