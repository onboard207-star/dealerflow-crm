ALTER TABLE "organization_invitations" ALTER COLUMN "invited_by" DROP NOT NULL;
ALTER TABLE "organization_configuration_versions" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_operator_source" CHECK ("invited_by" IS NOT NULL OR "idempotency_key" LIKE 'operator-provision:%');
CREATE POLICY "organization_invitations_signup_read" ON "organization_invitations" FOR SELECT USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND "token_hash" = nullif(current_setting('app.invitation_token_hash', true), '')
  AND lower("email") = lower(nullif(current_setting('app.invitation_signup_email', true), ''))
  AND "status" = 'pending' AND "expires_at" > now()
);
CREATE POLICY "organization_invitations_operator_insert" ON "organization_invitations" FOR INSERT WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.operator_provision', true), '') = 'enabled'
  AND "invited_by" IS NULL
  AND "idempotency_key" LIKE 'operator-provision:%'
);
CREATE POLICY "organization_invitations_operator_read" ON "organization_invitations" FOR SELECT USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.operator_provision', true), '') = 'enabled'
  AND "invited_by" IS NULL
  AND "idempotency_key" LIKE 'operator-provision:%'
);
