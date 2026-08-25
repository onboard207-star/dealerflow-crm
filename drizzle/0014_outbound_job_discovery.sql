CREATE FUNCTION list_due_outbound_attempts(batch_limit integer, due_before timestamptz)
RETURNS TABLE (organization_id text, attempt_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF batch_limit < 1 OR batch_limit > 100 THEN
    RAISE EXCEPTION 'batch_limit must be between 1 and 100';
  END IF;
  RETURN QUERY
    SELECT attempt.organization_id, attempt.id
    FROM communication_send_attempts attempt
    JOIN integration_accounts integration
      ON integration.organization_id = attempt.organization_id
     AND integration.id = attempt.integration_id
     AND integration.active = true
    WHERE attempt.status = 'queued' AND attempt.not_before <= due_before
    ORDER BY attempt.not_before, attempt.id
    LIMIT batch_limit;
END $$;
REVOKE ALL ON FUNCTION list_due_outbound_attempts(integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_due_outbound_attempts(integer, timestamptz) TO CURRENT_USER;
