-- Reconcile team-chat capabilities for system roles that predate migration 0060.
--
-- Tenant tables use FORCE ROW LEVEL SECURITY. A cross-tenant INSERT ... SELECT
-- without tenant context is therefore safely filtered to zero rows. Temporarily
-- return these two tables to owner-bypass semantics inside this migration's
-- transaction, perform the bounded system-role grant, and restore FORCE RLS
-- before the transaction can commit.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_capabilities" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "role_capabilities" ("role_id", "organization_id", "capability")
SELECT role.id, role.organization_id, grant_record.capability
FROM "roles" role
CROSS JOIN (VALUES ('team_chat.read'), ('team_chat.write')) AS grant_record(capability)
WHERE role.system = true
ON CONFLICT ("role_id", "capability") DO NOTHING;

ALTER TABLE "role_capabilities" FORCE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
