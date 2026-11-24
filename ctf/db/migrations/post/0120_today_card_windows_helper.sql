-- Safe to re-run.
-- today_card_windows gains helper_user_id: the member a poster named with Done when closing an ask
-- from Today. Until now the name was kept only when the ask was the day's credit card, so a
-- SocketRelay ask closed as done from Today counted for nobody toward Weavers of the Commons, while
-- the same help given through a 3.0 SocketRelay fulfillment counted for the fulfiller. Rows closed
-- before this keep the helper wherever the day's credit card recorded one. The demo schema's copy
-- gets the same column.
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS helper_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_today_card_windows_helper ON today_card_windows(helper_user_id) WHERE helper_user_id IS NOT NULL;
UPDATE today_card_windows w
   SET helper_user_id = d.helper_user_id
  FROM today_daily_credit_cards d
 WHERE d.card_id = w.card_id
   AND w.outcome = 'done'
   AND w.helper_user_id IS NULL
   AND d.helper_user_id IS NOT NULL
   AND d.helper_user_id <> w.owner_user_id;
ALTER TABLE IF EXISTS demo.today_card_windows ADD COLUMN IF NOT EXISTS helper_user_id TEXT;
DO $$
BEGIN
  IF to_regclass('demo.today_card_windows') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_today_card_windows_helper
      ON demo.today_card_windows(helper_user_id) WHERE helper_user_id IS NOT NULL;
  END IF;
END $$;
