CREATE POLICY "organization_invitations_operator_update" ON "organization_invitations"
FOR UPDATE
USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.operator_provision', true), '') = 'enabled'
  AND "invited_by" IS NULL
  AND "idempotency_key" LIKE 'operator-provision:%'
)
WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.operator_provision', true), '') = 'enabled'
  AND "invited_by" IS NULL
  AND "idempotency_key" LIKE 'operator-provision:%'
);
