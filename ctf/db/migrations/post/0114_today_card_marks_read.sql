-- Safe to re-run.
-- today_card_marks gains a third mark, `read`: opening a card marks it read, and it stays on Today
-- the day it was marked, as `done` did until now. `done` is the timeline dot alone, and a card marked
-- done leaves Today at once (owner report, 2026-11-23). Both appear in Me → Read. Marks already
-- stored as `done` keep that value. The demo schema's copy gets the same check.
ALTER TABLE IF EXISTS today_card_marks DROP CONSTRAINT IF EXISTS today_card_marks_mark_check;
ALTER TABLE IF EXISTS today_card_marks ADD CONSTRAINT today_card_marks_mark_check CHECK (mark IN ('done', 'read', 'not_for_me'));
ALTER TABLE IF EXISTS demo.today_card_marks DROP CONSTRAINT IF EXISTS today_card_marks_mark_check;
ALTER TABLE IF EXISTS demo.today_card_marks ADD CONSTRAINT today_card_marks_mark_check CHECK (mark IN ('done', 'read', 'not_for_me'));
