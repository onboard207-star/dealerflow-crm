CREATE FUNCTION create_team_message_notifications(target_organization_id text,target_conversation_id text,target_message_id text,target_sender_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
SET row_security=off
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF target_organization_id IS DISTINCT FROM nullif(current_setting('app.organization_id',true),'')
    OR target_sender_id IS DISTINCT FROM nullif(current_setting('app.user_id',true),'') THEN
    RAISE EXCEPTION 'team notification context is invalid';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM team_messages message
    JOIN team_conversations conversation ON conversation.organization_id=message.organization_id AND conversation.id=message.conversation_id
    WHERE message.organization_id=target_organization_id AND message.id=target_message_id
      AND message.conversation_id=target_conversation_id AND message.sender_user_id=target_sender_id
      AND target_sender_id=ANY(conversation.participant_user_ids)
  ) THEN RAISE EXCEPTION 'team notification message authority is invalid'; END IF;

  INSERT INTO notifications(id,organization_id,location_id,recipient_user_id,kind,title,body,href,source_type,source_id,dedupe_key)
  SELECT 'ntf_'||md5(target_organization_id||target_message_id||participant.user_id),conversation.organization_id,conversation.location_id,
    participant.user_id,'team-message','New team message','New activity in '||COALESCE(NULLIF(trim(conversation.name),''),'a direct conversation')||'.',
    '/organizations/'||target_organization_id||'/communications?conversation='||target_conversation_id,'team-message',target_message_id,
    'team-message:'||target_message_id||':'||participant.user_id
  FROM team_conversations conversation
  JOIN team_conversation_participants participant ON participant.organization_id=conversation.organization_id AND participant.conversation_id=conversation.id
  JOIN organization_memberships membership ON membership.organization_id=participant.organization_id AND membership.user_id=participant.user_id AND membership.status='active'
  WHERE conversation.organization_id=target_organization_id AND conversation.id=target_conversation_id AND participant.user_id<>target_sender_id
    AND participant.user_id=ANY(conversation.participant_user_ids)
    AND (conversation.location_id IS NULL OR membership.all_locations OR EXISTS(
      SELECT 1 FROM membership_locations location_grant WHERE location_grant.organization_id=membership.organization_id
        AND location_grant.membership_id=membership.id AND location_grant.location_id=conversation.location_id
    ))
  ON CONFLICT(organization_id,dedupe_key) DO NOTHING;
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  RETURN inserted_count;
END
$$;
REVOKE ALL ON FUNCTION create_team_message_notifications(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_team_message_notifications(text,text,text,text) TO CURRENT_USER;
