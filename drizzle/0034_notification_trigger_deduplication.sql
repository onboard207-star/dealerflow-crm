CREATE OR REPLACE FUNCTION notify_task_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient text; customer_name text;
BEGIN
  recipient := COALESCE(NEW.assigned_user_id, NEW.created_by);
  SELECT display_name INTO customer_name FROM customers WHERE organization_id = NEW.organization_id AND id = NEW.customer_id;
  IF recipient IS NOT NULL AND notification_recipient_is_active(NEW.organization_id, recipient, NEW.location_id) THEN
    BEGIN
      INSERT INTO notifications(id, organization_id, location_id, recipient_user_id, kind, title, body, href, source_type, source_id, dedupe_key)
      VALUES('ntf_' || md5(NEW.organization_id || 'task' || NEW.id || recipient), NEW.organization_id, NEW.location_id, recipient, 'task-assigned', 'Task assigned', NEW.title || ' · ' || COALESCE(customer_name, 'Customer'), '/organizations/' || NEW.organization_id || '/customers/' || NEW.customer_id, 'task', NEW.id, 'task:' || NEW.id || ':' || recipient);
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION notify_deal_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE deal_record record; recipient record;
BEGIN
  SELECT d.location_id, d.customer_id, d.deal_number INTO deal_record FROM deals d WHERE d.organization_id = NEW.organization_id AND d.id = NEW.deal_id;
  IF NEW.to_status = 'pending-approval' THEN
    FOR recipient IN
      SELECT m.user_id
      FROM organization_memberships m
      WHERE m.organization_id = NEW.organization_id
        AND m.status = 'active'
        AND notification_recipient_is_active(m.organization_id, m.user_id, deal_record.location_id)
        AND EXISTS(
          SELECT 1
          FROM membership_roles mr
          JOIN role_capabilities rc ON rc.organization_id = mr.organization_id AND rc.role_id = mr.role_id
          WHERE mr.organization_id = m.organization_id AND mr.membership_id = m.id AND rc.capability = 'deal.approve'
        )
    LOOP
      BEGIN
        INSERT INTO notifications(id, organization_id, location_id, recipient_user_id, kind, title, body, href, source_type, source_id, dedupe_key)
        VALUES('ntf_' || md5(NEW.organization_id || 'approval' || NEW.id || recipient.user_id), NEW.organization_id, deal_record.location_id, recipient.user_id, 'deal-approval', 'Deal approval requested', deal_record.deal_number || ' is awaiting approval', '/organizations/' || NEW.organization_id || '/customers/' || deal_record.customer_id, 'deal', NEW.deal_id, 'deal-approval:' || NEW.id || ':' || recipient.user_id);
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
