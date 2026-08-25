CREATE POLICY "organizations_active_member_select" ON "organizations"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "organization_memberships" membership
      WHERE membership."organization_id" = "organizations"."id"
        AND membership."user_id" = nullif(current_setting('app.user_id', true), '')
        AND membership."status" = 'active'
    )
  );
