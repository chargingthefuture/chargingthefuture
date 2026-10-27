-- post/0071: Drop Chyme's room chat.
--
-- Owner decision, 3.1.0: Chyme rooms are for listening and speaking, with no text chat. The chat
-- screens, the message routes and their code are removed in the same change, so nothing reads or
-- writes this table. Tips are unaffected: they are ServiceCredits transfers, not messages. Copies of
-- messages sent before 2026-10-16 that still sit on Stream are removed with the member's Stream user
-- when they delete their account, as before. The demo schema's copy goes too. Safe to re-run.
DROP TABLE IF EXISTS chyme_messages;
DROP TABLE IF EXISTS demo.chyme_messages;
