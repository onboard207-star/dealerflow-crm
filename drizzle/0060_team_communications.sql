CREATE TABLE "team_conversations"(
  "id" text PRIMARY KEY,"organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,"location_id" text,
  "kind" text NOT NULL,"name" text,"created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "idempotency_key" text NOT NULL,"archived_at" timestamptz,"created_at" timestamptz DEFAULT now() NOT NULL,"updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "team_conversations_id_format" CHECK("id"~'^cnv_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "team_conversations_kind" CHECK("kind" IN('direct','group','department','record')),
  CONSTRAINT "team_conversations_name" CHECK(("kind"='direct' AND "name" IS NULL) OR ("kind"<>'direct' AND length(trim("name")) BETWEEN 1 AND 120)),
  CONSTRAINT "team_conversations_same_location_fk" FOREIGN KEY("organization_id","location_id") REFERENCES "locations"("organization_id","id")
);
CREATE UNIQUE INDEX "team_conversations_org_id_unique" ON "team_conversations"("organization_id","id");
CREATE UNIQUE INDEX "team_conversations_idempotency_unique" ON "team_conversations"("organization_id","idempotency_key");
CREATE INDEX "team_conversations_location_updated_idx" ON "team_conversations"("organization_id","location_id","updated_at" DESC);

CREATE TABLE "team_conversation_participants"(
  "organization_id" text NOT NULL,"conversation_id" text NOT NULL,"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'member' NOT NULL,"joined_at" timestamptz DEFAULT now() NOT NULL,"last_read_at" timestamptz,
  PRIMARY KEY("conversation_id","user_id"),
  CONSTRAINT "team_participants_same_conversation_fk" FOREIGN KEY("organization_id","conversation_id") REFERENCES "team_conversations"("organization_id","id") ON DELETE CASCADE,
  CONSTRAINT "team_participants_role" CHECK("role" IN('owner','member'))
);
CREATE INDEX "team_participants_user_idx" ON "team_conversation_participants"("organization_id","user_id","conversation_id");

CREATE TABLE "team_messages"(
  "id" text PRIMARY KEY,"organization_id" text NOT NULL,"conversation_id" text NOT NULL,"sender_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "body" text NOT NULL,"kind" text DEFAULT 'text' NOT NULL,"idempotency_key" text NOT NULL,"created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "team_messages_id_format" CHECK("id"~'^msg_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "team_messages_body" CHECK(length(trim("body")) BETWEEN 1 AND 4000),
  CONSTRAINT "team_messages_kind" CHECK("kind" IN('text','system','record')),
  CONSTRAINT "team_messages_same_conversation_fk" FOREIGN KEY("organization_id","conversation_id") REFERENCES "team_conversations"("organization_id","id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "team_messages_org_id_unique" ON "team_messages"("organization_id","id");
CREATE UNIQUE INDEX "team_messages_idempotency_unique" ON "team_messages"("organization_id","conversation_id","idempotency_key");
CREATE INDEX "team_messages_conversation_time_idx" ON "team_messages"("organization_id","conversation_id","created_at","id");

CREATE TABLE "team_message_references"(
  "id" text PRIMARY KEY,"organization_id" text NOT NULL,"message_id" text NOT NULL,"entity_type" text NOT NULL,"entity_id" text NOT NULL,
  "label" text NOT NULL,"href" text NOT NULL,"created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "team_message_references_id_format" CHECK("id"~'^mrf_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "team_message_references_type" CHECK("entity_type" IN('customer','lead','deal','quote','vehicle','inventory','appointment','document')),
  CONSTRAINT "team_message_references_label" CHECK(length(trim("label")) BETWEEN 1 AND 200),
  CONSTRAINT "team_message_references_href" CHECK("href" LIKE '/organizations/%'),
  CONSTRAINT "team_message_references_same_message_fk" FOREIGN KEY("organization_id","message_id") REFERENCES "team_messages"("organization_id","id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "team_message_references_message_unique" ON "team_message_references"("organization_id","message_id","entity_type","entity_id");

CREATE FUNCTION team_conversation_member(target_organization_id text,target_conversation_id text,target_user_id text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM public.team_conversation_participants p JOIN public.organization_memberships m ON m.organization_id=p.organization_id AND m.user_id=p.user_id AND m.status='active' WHERE p.organization_id=target_organization_id AND p.conversation_id=target_conversation_id AND p.user_id=target_user_id)
$$;
REVOKE ALL ON FUNCTION team_conversation_member(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION team_conversation_member(text,text,text) TO CURRENT_USER;
CREATE FUNCTION team_conversation_created_by(target_organization_id text,target_conversation_id text,target_user_id text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM public.team_conversations c WHERE c.organization_id=target_organization_id AND c.id=target_conversation_id AND c.created_by=target_user_id)
$$;
CREATE FUNCTION team_message_sent_by(target_organization_id text,target_message_id text,target_user_id text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM public.team_messages m WHERE m.organization_id=target_organization_id AND m.id=target_message_id AND m.sender_user_id=target_user_id)
$$;
CREATE FUNCTION team_participant_eligible(target_organization_id text,target_conversation_id text,target_user_id text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM public.team_conversations c JOIN public.organization_memberships m ON m.organization_id=c.organization_id AND m.user_id=target_user_id AND m.status='active' WHERE c.organization_id=target_organization_id AND c.id=target_conversation_id AND (c.location_id IS NULL OR m.all_locations OR EXISTS(SELECT 1 FROM public.membership_locations ml WHERE ml.organization_id=m.organization_id AND ml.membership_id=m.id AND ml.location_id=c.location_id)))
$$;
REVOKE ALL ON FUNCTION team_conversation_created_by(text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION team_conversation_created_by(text,text,text) TO CURRENT_USER;
REVOKE ALL ON FUNCTION team_message_sent_by(text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION team_message_sent_by(text,text,text) TO CURRENT_USER;
REVOKE ALL ON FUNCTION team_participant_eligible(text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION team_participant_eligible(text,text,text) TO CURRENT_USER;

ALTER TABLE "team_conversations" ENABLE ROW LEVEL SECURITY;ALTER TABLE "team_conversations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "team_conversation_participants" ENABLE ROW LEVEL SECURITY;ALTER TABLE "team_conversation_participants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "team_messages" ENABLE ROW LEVEL SECURITY;ALTER TABLE "team_messages" FORCE ROW LEVEL SECURITY;
ALTER TABLE "team_message_references" ENABLE ROW LEVEL SECURITY;ALTER TABLE "team_message_references" FORCE ROW LEVEL SECURITY;

CREATE POLICY "team_conversations_participant_select" ON "team_conversations" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),'') AND team_conversation_member("organization_id","id",nullif(current_setting('app.user_id',true),'')));
CREATE POLICY "team_conversations_tenant_insert" ON "team_conversations" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "created_by"=nullif(current_setting('app.user_id',true),''));
CREATE POLICY "team_conversations_participant_update" ON "team_conversations" FOR UPDATE USING(team_conversation_member("organization_id","id",nullif(current_setting('app.user_id',true),''))) WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND team_conversation_member("organization_id","id",nullif(current_setting('app.user_id',true),'')));
CREATE POLICY "team_participants_member_select" ON "team_conversation_participants" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),'') AND team_conversation_member("organization_id","conversation_id",nullif(current_setting('app.user_id',true),'')));
CREATE POLICY "team_participants_creator_insert" ON "team_conversation_participants" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND team_conversation_created_by("organization_id","conversation_id",nullif(current_setting('app.user_id',true),'')) AND team_participant_eligible("organization_id","conversation_id","user_id"));
CREATE POLICY "team_participants_self_update" ON "team_conversation_participants" FOR UPDATE USING("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "user_id"=nullif(current_setting('app.user_id',true),'')) WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "user_id"=nullif(current_setting('app.user_id',true),''));
CREATE POLICY "team_messages_participant_select" ON "team_messages" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),'') AND team_conversation_member("organization_id","conversation_id",nullif(current_setting('app.user_id',true),'')));
CREATE POLICY "team_messages_participant_insert" ON "team_messages" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "sender_user_id"=nullif(current_setting('app.user_id',true),'') AND team_conversation_member("organization_id","conversation_id","sender_user_id"));
CREATE POLICY "team_references_participant_select" ON "team_message_references" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),'') AND team_message_sent_by("organization_id","message_id",nullif(current_setting('app.user_id',true),'')) OR "organization_id"=nullif(current_setting('app.organization_id',true),'') AND EXISTS(SELECT 1 FROM team_messages m WHERE m.organization_id=team_message_references.organization_id AND m.id=team_message_references.message_id AND team_conversation_member(m.organization_id,m.conversation_id,nullif(current_setting('app.user_id',true),''))));
CREATE POLICY "team_references_sender_insert" ON "team_message_references" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),'') AND team_message_sent_by("organization_id","message_id",nullif(current_setting('app.user_id',true),'')));

CREATE FUNCTION prevent_team_message_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'team messages are immutable'; END $$;
CREATE TRIGGER "team_messages_immutable" BEFORE UPDATE OR DELETE ON "team_messages" FOR EACH ROW EXECUTE FUNCTION prevent_team_message_rewrite();
CREATE TRIGGER "team_references_immutable" BEFORE UPDATE OR DELETE ON "team_message_references" FOR EACH ROW EXECUTE FUNCTION prevent_team_message_rewrite();

INSERT INTO role_capabilities(role_id,organization_id,capability)
SELECT r.id,r.organization_id,c.capability FROM roles r CROSS JOIN (VALUES('team_chat.read'),('team_chat.write')) c(capability)
WHERE r.system=true ON CONFLICT DO NOTHING;
