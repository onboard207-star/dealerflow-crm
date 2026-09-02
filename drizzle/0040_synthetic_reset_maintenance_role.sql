DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'dealerflow_synthetic_reset_executor') THEN
    CREATE ROLE dealerflow_synthetic_reset_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO dealerflow_synthetic_reset_executor;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.organizations,
  public.organization_configurations,
  public.locations,
  public.users,
  public.roles,
  public.role_capabilities,
  public.organization_memberships,
  public.membership_roles,
  public.customers,
  public.leads,
  public.vehicles,
  public.inventory_units,
  public.lead_vehicle_interests,
  public.communications,
  public.appointments,
  public.tasks,
  public.deals,
  public.deal_status_events,
  public.deal_deliveries,
  public.audit_logs
TO dealerflow_synthetic_reset_executor;

CREATE POLICY "deal_status_events_synthetic_reset_delete"
ON public.deal_status_events
FOR DELETE
TO dealerflow_synthetic_reset_executor
USING (
  organization_id = 'org_demo_first_pilot_v1'
  AND organization_id = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.synthetic_fixture_version', true), '') = 'pilot-demo-v1'
  AND pg_catalog.pg_has_role(session_user, 'dealerflow_synthetic_reset_executor', 'member')
  AND EXISTS (
    SELECT 1 FROM public.organizations organization
    WHERE organization.id = deal_status_events.organization_id
      AND organization.slug = 'dealerflow-synthetic-pilot'
      AND organization.data_class = 'demo'
      AND organization.active = true
  )
);

CREATE POLICY "deal_deliveries_synthetic_reset_delete"
ON public.deal_deliveries
FOR DELETE
TO dealerflow_synthetic_reset_executor
USING (
  organization_id = 'org_demo_first_pilot_v1'
  AND organization_id = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.synthetic_fixture_version', true), '') = 'pilot-demo-v1'
  AND pg_catalog.pg_has_role(session_user, 'dealerflow_synthetic_reset_executor', 'member')
  AND EXISTS (
    SELECT 1 FROM public.organizations organization
    WHERE organization.id = deal_deliveries.organization_id
      AND organization.slug = 'dealerflow-synthetic-pilot'
      AND organization.data_class = 'demo'
      AND organization.active = true
  )
);

COMMENT ON ROLE dealerflow_synthetic_reset_executor IS
  'NOLOGIN role for the separately credentialed, staging-only DealerFlow synthetic reset runner.';
COMMENT ON POLICY "deal_status_events_synthetic_reset_delete" ON public.deal_status_events IS
  'Allows deletion only for the canonical versioned synthetic demo fixture by the dedicated maintenance identity.';
COMMENT ON POLICY "deal_deliveries_synthetic_reset_delete" ON public.deal_deliveries IS
  'Allows deletion only for the canonical versioned synthetic demo fixture by the dedicated maintenance identity.';
