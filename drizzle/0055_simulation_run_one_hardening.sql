WITH delivered AS (
  SELECT DISTINCT ON (deal.organization_id, deal.id)
    deal.organization_id,
    deal.id AS deal_id,
    deal.customer_id,
    deal.lead_id,
    event.occurred_at AS delivered_at,
    event.created_by AS actor_id
  FROM deals deal
  JOIN deal_status_events event
    ON event.organization_id = deal.organization_id
   AND event.deal_id = deal.id
   AND event.to_status = 'delivered'
  WHERE deal.status = 'delivered'
  ORDER BY deal.organization_id, deal.id, event.occurred_at DESC
), eligible AS (
  SELECT task.organization_id, task.id, task.status AS from_status,
    delivered.deal_id, delivered.delivered_at, delivered.actor_id
  FROM tasks task
  JOIN delivered
    ON delivered.organization_id = task.organization_id
   AND delivered.customer_id = task.customer_id
   AND (task.lead_id = delivered.lead_id OR task.lead_id IS NULL)
  WHERE task.status IN ('open','in-progress')
    AND task.created_at <= delivered.delivered_at
), updated AS (
  UPDATE tasks task
  SET status = 'cancelled',
      updated_by = eligible.actor_id,
      updated_at = eligible.delivered_at
  FROM eligible
  WHERE task.organization_id = eligible.organization_id
    AND task.id = eligible.id
  RETURNING task.organization_id, task.id, eligible.from_status,
    eligible.deal_id, eligible.delivered_at, eligible.actor_id
), status_events AS (
  INSERT INTO task_status_events (
    id, organization_id, task_id, from_status, to_status, reason,
    occurred_at, idempotency_key, created_by
  )
  SELECT 'tse_' || md5(organization_id || ':' || id || ':deal-delivered-hardening'),
    organization_id, id, from_status, 'cancelled',
    'Obsolete after Deal delivery.', delivered_at,
    'deal-delivered:' || deal_id || ':task:' || id, actor_id
  FROM updated
  ON CONFLICT (organization_id, idempotency_key) DO NOTHING
  RETURNING organization_id, task_id
)
INSERT INTO audit_logs (
  id, organization_id, actor_id, action, entity_type, entity_id,
  source, correlation_id, created_at
)
SELECT 'aud_' || md5(updated.organization_id || ':' || updated.id || ':deal-delivered-hardening'),
  updated.organization_id, updated.actor_id, 'task.cancelled', 'task', updated.id,
  'migration', 'simulation-run-one-hardening', updated.delivered_at
FROM updated
ON CONFLICT (id) DO NOTHING;
