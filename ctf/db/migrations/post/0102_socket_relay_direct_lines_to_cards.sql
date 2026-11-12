-- post/0102: SocketRelay's Direct Lines move into the conversation under the request's card.
--
-- 3.1 removes Direct Lines: the helper and the person who asked talk in the card's Just us two,
-- stored with every other card conversation in commons_item_messages (plugin 'socket-relay', item
-- the request id). Every fulfillment that had a Direct Line already had both people talking, so
-- each gets an agreed Just us two between them on its request. The few messages kept in this
-- database (socket_relay_messages) are copied there as Just us two messages with their author,
-- words and time; the copy is checked, and the table is dropped only when every message is there.
-- socket_relay_fulfillment_participants recorded who could open a Direct Line and nothing reads it
-- any more, so it is dropped too. Messages written on Stream stay readable, read-only, from the
-- request. Production and the demo schema. Safe to re-run.

DO $$
BEGIN
  IF to_regclass('socket_relay_fulfillments') IS NULL OR to_regclass('commons_item_pair_requests') IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO commons_item_pair_requests (plugin, item_id, user_low, user_high, requester_id, agreed_at, created_at)
  SELECT DISTINCT ON (f.request_id, LEAST(f.requester_user_id, f.fulfiller_user_id), GREATEST(f.requester_user_id, f.fulfiller_user_id))
         'socket-relay', f.request_id::text,
         LEAST(f.requester_user_id, f.fulfiller_user_id), GREATEST(f.requester_user_id, f.fulfiller_user_id),
         f.fulfiller_user_id, f.created_at, f.created_at
  FROM socket_relay_fulfillments f
  WHERE f.request_id IS NOT NULL AND f.requester_user_id <> f.fulfiller_user_id
  ORDER BY f.request_id, LEAST(f.requester_user_id, f.fulfiller_user_id), GREATEST(f.requester_user_id, f.fulfiller_user_id), f.created_at
  ON CONFLICT (plugin, item_id, user_low, user_high) DO UPDATE
    SET agreed_at = COALESCE(commons_item_pair_requests.agreed_at, EXCLUDED.agreed_at);
END $$;

DO $$
DECLARE
  missing INTEGER;
BEGIN
  IF to_regclass('socket_relay_messages') IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO commons_item_messages (id, plugin, item_id, author_id, body, pair_low, pair_high, created_at, moderation_status)
  SELECT m.id, 'socket-relay', f.request_id::text, m.sender_user_id, left(btrim(m.message_text), 1000),
         LEAST(f.requester_user_id, f.fulfiller_user_id), GREATEST(f.requester_user_id, f.fulfiller_user_id),
         m.created_at, COALESCE(m.moderation_status, 'accepted')
  FROM socket_relay_messages m
  JOIN socket_relay_fulfillments f ON f.id = m.fulfillment_id
  WHERE btrim(m.message_text) <> '' AND m.sender_user_id IN (f.requester_user_id, f.fulfiller_user_id)
    AND f.requester_user_id <> f.fulfiller_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Only a message with words, from one of the two, on a fulfillment that still exists can move; the
  -- rest could never be read (an empty message, or a fulfillment an admin removed).
  SELECT COUNT(*) INTO missing
  FROM socket_relay_messages m
  JOIN socket_relay_fulfillments f ON f.id = m.fulfillment_id
  WHERE btrim(m.message_text) <> '' AND m.sender_user_id IN (f.requester_user_id, f.fulfiller_user_id)
    AND f.requester_user_id <> f.fulfiller_user_id
    AND NOT EXISTS (SELECT 1 FROM commons_item_messages c WHERE c.id = m.id);
  IF missing > 0 THEN
    RAISE EXCEPTION 'post/0102: % SocketRelay messages were not copied; socket_relay_messages is kept', missing;
  END IF;

  DROP TABLE socket_relay_messages;
END $$;

DROP TABLE IF EXISTS socketrelay_messages;
DROP TABLE IF EXISTS socket_relay_fulfillment_participants;
DROP TABLE IF EXISTS socketrelay_fulfillment_participants;
