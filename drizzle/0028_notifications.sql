CREATE TABLE "notifications"(
  "id" text PRIMARY KEY,"organization_id" text NOT NULL,"location_id" text,"recipient_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,"title" text NOT NULL,"body" text NOT NULL,"href" text NOT NULL,"source_type" text NOT NULL,"source_id" text NOT NULL,"dedupe_key" text NOT NULL,
  "read_at" timestamptz,"created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "notifications_id_format" CHECK("id"~'^ntf_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "notifications_kind" CHECK("kind" IN('task-assigned','deal-approval')),
  CONSTRAINT "notifications_content_length" CHECK(length(trim("title")) BETWEEN 1 AND 200 AND length(trim("body")) BETWEEN 1 AND 500),
  CONSTRAINT "notifications_href_internal" CHECK("href" LIKE '/organizations/%'),
  CONSTRAINT "notifications_same_location_fk" FOREIGN KEY("organization_id","location_id") REFERENCES "locations"("organization_id","id")
);
CREATE UNIQUE INDEX "notifications_organization_id_unique" ON "notifications"("organization_id","id");
CREATE UNIQUE INDEX "notifications_dedupe_unique" ON "notifications"("organization_id","dedupe_key");
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications"("organization_id","recipient_user_id","created_at" DESC) WHERE "read_at" IS NULL;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notifications_recipient_select" ON "notifications" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "recipient_user_id"=nullif(current_setting('app.user_id',true),''));
CREATE POLICY "notifications_tenant_insert" ON "notifications" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND EXISTS(SELECT 1 FROM organization_memberships m WHERE m.organization_id=notifications.organization_id AND m.user_id=notifications.recipient_user_id AND m.status='active' AND (notifications.location_id IS NULL OR m.all_locations OR EXISTS(SELECT 1 FROM membership_locations ml WHERE ml.organization_id=m.organization_id AND ml.membership_id=m.id AND ml.location_id=notifications.location_id))));
CREATE POLICY "notifications_recipient_update" ON "notifications" FOR UPDATE USING("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "recipient_user_id"=nullif(current_setting('app.user_id',true),'')) WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "recipient_user_id"=nullif(current_setting('app.user_id',true),''));

CREATE FUNCTION prevent_notification_authority_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.id,NEW.organization_id,NEW.location_id,NEW.recipient_user_id,NEW.kind,NEW.title,NEW.body,NEW.href,NEW.source_type,NEW.source_id,NEW.dedupe_key,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.location_id,OLD.recipient_user_id,OLD.kind,OLD.title,OLD.body,OLD.href,OLD.source_type,OLD.source_id,OLD.dedupe_key,OLD.created_at) OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at) OR (NEW.read_at IS DISTINCT FROM OLD.read_at AND (NEW.read_at IS NULL OR NEW.read_at>now()+interval '1 minute')) THEN RAISE EXCEPTION 'notification authority fields are immutable';END IF;RETURN NEW;
END $$;
CREATE TRIGGER "notifications_authority_immutable" BEFORE UPDATE ON "notifications" FOR EACH ROW EXECUTE FUNCTION prevent_notification_authority_rewrite();

CREATE FUNCTION notify_task_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE recipient text;customer_name text;BEGIN
  recipient:=COALESCE(NEW.assigned_user_id,NEW.created_by);SELECT display_name INTO customer_name FROM customers WHERE organization_id=NEW.organization_id AND id=NEW.customer_id;
  IF recipient IS NOT NULL AND EXISTS(SELECT 1 FROM organization_memberships m WHERE m.organization_id=NEW.organization_id AND m.user_id=recipient AND m.status='active' AND (m.all_locations OR EXISTS(SELECT 1 FROM membership_locations ml WHERE ml.organization_id=m.organization_id AND ml.membership_id=m.id AND ml.location_id=NEW.location_id))) THEN
    INSERT INTO notifications(id,organization_id,location_id,recipient_user_id,kind,title,body,href,source_type,source_id,dedupe_key) VALUES('ntf_'||md5(NEW.organization_id||'task'||NEW.id||recipient),NEW.organization_id,NEW.location_id,recipient,'task-assigned','Task assigned',NEW.title||' · '||COALESCE(customer_name,'Customer'),'/organizations/'||NEW.organization_id||'/customers/'||NEW.customer_id,'task',NEW.id,'task:'||NEW.id||':'||recipient) ON CONFLICT(organization_id,dedupe_key) DO NOTHING;
  END IF;RETURN NEW;END $$;
CREATE TRIGGER "tasks_create_notification" AFTER INSERT ON "tasks" FOR EACH ROW EXECUTE FUNCTION notify_task_assignment();

CREATE FUNCTION notify_deal_approval() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE deal_record record;BEGIN
  SELECT d.location_id,d.customer_id,d.deal_number INTO deal_record FROM deals d WHERE d.organization_id=NEW.organization_id AND d.id=NEW.deal_id;
  IF NEW.to_status='pending-approval' THEN INSERT INTO notifications(id,organization_id,location_id,recipient_user_id,kind,title,body,href,source_type,source_id,dedupe_key)
    SELECT 'ntf_'||md5(NEW.organization_id||'approval'||NEW.id||m.user_id),NEW.organization_id,deal_record.location_id,m.user_id,'deal-approval','Deal approval requested',deal_record.deal_number||' is awaiting approval','/organizations/'||NEW.organization_id||'/customers/'||deal_record.customer_id,'deal',NEW.deal_id,'deal-approval:'||NEW.id||':'||m.user_id
    FROM organization_memberships m WHERE m.organization_id=NEW.organization_id AND m.status='active' AND (m.all_locations OR EXISTS(SELECT 1 FROM membership_locations ml WHERE ml.organization_id=m.organization_id AND ml.membership_id=m.id AND ml.location_id=deal_record.location_id)) AND EXISTS(SELECT 1 FROM membership_roles mr JOIN role_capabilities rc ON rc.organization_id=mr.organization_id AND rc.role_id=mr.role_id WHERE mr.organization_id=m.organization_id AND mr.membership_id=m.id AND rc.capability='deal.approve') ON CONFLICT(organization_id,dedupe_key) DO NOTHING;
  END IF;RETURN NEW;END $$;
CREATE TRIGGER "deal_status_notification" AFTER INSERT ON "deal_status_events" FOR EACH ROW EXECUTE FUNCTION notify_deal_approval();
