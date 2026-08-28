CREATE FUNCTION notification_recipient_is_active(target_organization_id text, target_user_id text, target_location_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships membership
    WHERE membership.organization_id = target_organization_id
      AND membership.user_id = target_user_id
      AND membership.status = 'active'
      AND (
        target_location_id IS NULL
        OR membership.all_locations
        OR EXISTS (
          SELECT 1
          FROM public.membership_locations location_grant
          WHERE location_grant.organization_id = membership.organization_id
            AND location_grant.membership_id = membership.id
            AND location_grant.location_id = target_location_id
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION notification_recipient_is_active(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notification_recipient_is_active(text, text, text) TO CURRENT_USER;

DROP POLICY "notifications_tenant_insert" ON "notifications";
CREATE POLICY "notifications_tenant_insert" ON "notifications" FOR INSERT WITH CHECK(
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND notification_recipient_is_active("organization_id", "recipient_user_id", "location_id")
);
