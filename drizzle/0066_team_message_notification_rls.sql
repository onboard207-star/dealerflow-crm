DROP FUNCTION create_team_message_notifications(text,text,text,text);

DROP POLICY "notifications_tenant_insert" ON "notifications";
CREATE POLICY "notifications_tenant_insert" ON "notifications" FOR INSERT WITH CHECK(
  "organization_id"=nullif(current_setting('app.organization_id',true),'')
  AND (
    notification_recipient_is_active("organization_id","recipient_user_id","location_id")
    OR (
      "kind"='team-message' AND "source_type"='team-message'
      AND "recipient_user_id"<>nullif(current_setting('app.user_id',true),'')
      AND EXISTS(
        SELECT 1 FROM team_messages message
        JOIN team_conversations conversation ON conversation.organization_id=message.organization_id AND conversation.id=message.conversation_id
        WHERE message.organization_id=notifications.organization_id AND message.id=notifications.source_id
          AND message.sender_user_id=nullif(current_setting('app.user_id',true),'')
          AND notifications.recipient_user_id=ANY(conversation.participant_user_ids)
          AND notifications.location_id IS NOT DISTINCT FROM conversation.location_id
          AND notifications.href='/organizations/'||notifications.organization_id||'/communications?conversation='||conversation.id
      )
    )
  )
);
