CREATE TABLE "team_conversation_participant_events"(
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "added_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "old_participant_user_ids" text[] NOT NULL,
  "new_participant_user_ids" text[] NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "team_participant_events_id_format" CHECK("id"~'^tpe_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "team_participant_events_same_conversation_fk" FOREIGN KEY("organization_id","conversation_id") REFERENCES "team_conversations"("organization_id","id") ON DELETE CASCADE,
  CONSTRAINT "team_participant_events_addition" CHECK(
    cardinality("new_participant_user_ids") = cardinality("old_participant_user_ids") + 1
    AND "added_user_id" = ANY("new_participant_user_ids")
    AND NOT "added_user_id" = ANY("old_participant_user_ids")
  )
);
CREATE UNIQUE INDEX "team_participant_events_org_id_unique" ON "team_conversation_participant_events"("organization_id","id");
CREATE UNIQUE INDEX "team_participant_events_idempotency_unique" ON "team_conversation_participant_events"("organization_id","conversation_id","idempotency_key");
CREATE INDEX "team_participant_events_conversation_time_idx" ON "team_conversation_participant_events"("organization_id","conversation_id","created_at");

ALTER TABLE "team_conversation_participant_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_conversation_participant_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "team_participant_events_member_select" ON "team_conversation_participant_events" FOR SELECT USING(
  "organization_id"=nullif(current_setting('app.organization_id',true),'')
  AND nullif(current_setting('app.user_id',true),'')=ANY("new_participant_user_ids")
);
CREATE POLICY "team_participant_events_owner_insert" ON "team_conversation_participant_events" FOR INSERT WITH CHECK(
  "organization_id"=nullif(current_setting('app.organization_id',true),'')
  AND "actor_user_id"=nullif(current_setting('app.user_id',true),'')
  AND "actor_user_id"=ANY("old_participant_user_ids")
  AND EXISTS(SELECT 1 FROM "team_conversations" conversation WHERE conversation.organization_id="team_conversation_participant_events".organization_id AND conversation.id="team_conversation_participant_events".conversation_id AND conversation.created_by="team_conversation_participant_events".actor_user_id AND conversation.kind<>'direct' AND conversation.participant_user_ids="team_conversation_participant_events".old_participant_user_ids)
);

DROP TRIGGER "team_conversation_participants_immutable" ON "team_conversations";
DROP FUNCTION prevent_team_conversation_participant_rewrite();
CREATE FUNCTION prevent_ungoverned_team_conversation_participant_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.participant_user_ids IS DISTINCT FROM OLD.participant_user_ids AND NOT EXISTS(
    SELECT 1 FROM team_conversation_participant_events event
    WHERE event.organization_id=NEW.organization_id AND event.conversation_id=NEW.id
      AND event.actor_user_id=nullif(current_setting('app.user_id',true),'')
      AND event.old_participant_user_ids=OLD.participant_user_ids
      AND event.new_participant_user_ids=NEW.participant_user_ids
  ) THEN RAISE EXCEPTION 'conversation participant change requires immutable evidence'; END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "team_conversation_participants_governed"
BEFORE UPDATE OF "participant_user_ids" ON "team_conversations"
FOR EACH ROW EXECUTE FUNCTION prevent_ungoverned_team_conversation_participant_rewrite();

CREATE FUNCTION prevent_team_participant_event_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'team participant events are immutable'; END $$;
CREATE TRIGGER "team_participant_events_immutable" BEFORE UPDATE OR DELETE ON "team_conversation_participant_events" FOR EACH ROW EXECUTE FUNCTION prevent_team_participant_event_rewrite();
