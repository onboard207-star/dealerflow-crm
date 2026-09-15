-- Reconcile inventory write capabilities for protected system roles that
-- predate the canonical inventory administration capability mapping.
--
-- Tenant tables use FORCE ROW LEVEL SECURITY. Temporarily return the bounded
-- role tables to owner-bypass semantics inside this migration transaction,
-- apply only the canonical system-role grants, and restore FORCE RLS before
-- the transaction can commit.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_capabilities" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "role_capabilities" ("role_id", "organization_id", "capability")
SELECT role.id, role.organization_id, grant_record.capability
FROM "roles" role
CROSS JOIN (VALUES ('inventory.create'), ('inventory.update')) AS grant_record(capability)
WHERE role.system = true
  AND role.key IN ('owner', 'general-manager', 'inventory-manager')
ON CONFLICT ("role_id", "capability") DO NOTHING;

ALTER TABLE "role_capabilities" FORCE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
