ALTER TABLE "team_conversations" ADD COLUMN "participant_user_ids" text[];

-- Preserve any already-created conversation membership before making the
-- immutable participant set authoritative. The migration is transactional and
-- fails closed if a conversation does not have a valid participant set.
ALTER TABLE "team_conversations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "team_conversation_participants" NO FORCE ROW LEVEL SECURITY;

UPDATE "team_conversations" conversation
SET "participant_user_ids" = participant_set.user_ids
FROM (
  SELECT "organization_id", "conversation_id", array_agg("user_id" ORDER BY "user_id") AS user_ids
  FROM "team_conversation_participants"
  GROUP BY "organization_id", "conversation_id"
) participant_set
WHERE participant_set.organization_id = conversation.organization_id
  AND participant_set.conversation_id = conversation.id;

ALTER TABLE "team_conversations" ALTER COLUMN "participant_user_ids" SET NOT NULL;
ALTER TABLE "team_conversations" ADD CONSTRAINT "team_conversations_participant_count"
  CHECK (cardinality("participant_user_ids") BETWEEN 2 AND 100);
ALTER TABLE "team_conversations" ADD CONSTRAINT "team_conversations_creator_participates"
  CHECK ("created_by" = ANY("participant_user_ids"));

ALTER TABLE "team_conversation_participants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "team_conversations" FORCE ROW LEVEL SECURITY;

DROP POLICY "team_conversations_participant_select" ON "team_conversations";
DROP POLICY "team_conversations_tenant_insert" ON "team_conversations";
DROP POLICY "team_conversations_participant_update" ON "team_conversations";
DROP POLICY "team_participants_member_select" ON "team_conversation_participants";
DROP POLICY "team_participants_creator_insert" ON "team_conversation_participants";
DROP POLICY "team_messages_participant_select" ON "team_messages";
DROP POLICY "team_messages_participant_insert" ON "team_messages";
DROP POLICY "team_references_participant_select" ON "team_message_references";
DROP POLICY "team_references_sender_insert" ON "team_message_references";

CREATE POLICY "team_conversations_participant_select" ON "team_conversations" FOR SELECT USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.user_id', true), '') = ANY("participant_user_ids")
);
CREATE POLICY "team_conversations_tenant_insert" ON "team_conversations" FOR INSERT WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND "created_by" = nullif(current_setting('app.user_id', true), '')
  AND "created_by" = ANY("participant_user_ids")
);
CREATE POLICY "team_conversations_participant_update" ON "team_conversations" FOR UPDATE USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.user_id', true), '') = ANY("participant_user_ids")
) WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND nullif(current_setting('app.user_id', true), '') = ANY("participant_user_ids")
);

CREATE POLICY "team_participants_member_select" ON "team_conversation_participants" FOR SELECT USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND EXISTS (
    SELECT 1 FROM "team_conversations" conversation
    WHERE conversation.organization_id = team_conversation_participants.organization_id
      AND conversation.id = team_conversation_participants.conversation_id
      AND nullif(current_setting('app.user_id', true), '') = ANY(conversation.participant_user_ids)
  )
);
CREATE POLICY "team_participants_creator_insert" ON "team_conversation_participants" FOR INSERT WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND EXISTS (
    SELECT 1 FROM "team_conversations" conversation
    WHERE conversation.organization_id = team_conversation_participants.organization_id
      AND conversation.id = team_conversation_participants.conversation_id
      AND conversation.created_by = nullif(current_setting('app.user_id', true), '')
      AND team_conversation_participants.user_id = ANY(conversation.participant_user_ids)
  )
  AND EXISTS (
    SELECT 1 FROM "organization_memberships" membership
    WHERE membership.organization_id = team_conversation_participants.organization_id
      AND membership.user_id = team_conversation_participants.user_id
      AND membership.status = 'active'
  )
);

CREATE POLICY "team_messages_participant_select" ON "team_messages" FOR SELECT USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND EXISTS (
    SELECT 1 FROM "team_conversations" conversation
    WHERE conversation.organization_id = team_messages.organization_id
      AND conversation.id = team_messages.conversation_id
      AND nullif(current_setting('app.user_id', true), '') = ANY(conversation.participant_user_ids)
  )
);
CREATE POLICY "team_messages_participant_insert" ON "team_messages" FOR INSERT WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND "sender_user_id" = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (
    SELECT 1 FROM "team_conversations" conversation
    WHERE conversation.organization_id = team_messages.organization_id
      AND conversation.id = team_messages.conversation_id
      AND team_messages.sender_user_id = ANY(conversation.participant_user_ids)
  )
);

CREATE POLICY "team_references_participant_select" ON "team_message_references" FOR SELECT USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND EXISTS (
    SELECT 1 FROM "team_messages" message
    WHERE message.organization_id = team_message_references.organization_id
      AND message.id = team_message_references.message_id
  )
);
CREATE POLICY "team_references_sender_insert" ON "team_message_references" FOR INSERT WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')
  AND EXISTS (
    SELECT 1 FROM "team_messages" message
    WHERE message.organization_id = team_message_references.organization_id
      AND message.id = team_message_references.message_id
      AND message.sender_user_id = nullif(current_setting('app.user_id', true), '')
  )
);

DROP FUNCTION team_conversation_member(text, text, text);
DROP FUNCTION team_conversation_created_by(text, text, text);
DROP FUNCTION team_message_sent_by(text, text, text);
DROP FUNCTION team_participant_eligible(text, text, text);

CREATE FUNCTION prevent_team_conversation_participant_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.participant_user_ids IS DISTINCT FROM OLD.participant_user_ids THEN
    RAISE EXCEPTION 'conversation participants are immutable';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "team_conversation_participants_immutable"
BEFORE UPDATE OF "participant_user_ids" ON "team_conversations"
FOR EACH ROW EXECUTE FUNCTION prevent_team_conversation_participant_rewrite();
