-- Personal mute of a post or thread (3.1.0, owner-approved plan, Personal controls). member_mutes
-- gains a third kind, 'post', whose target is a Today card id and whose label is the card's title
-- when it was muted. The muted card leaves that member's Today, and its conversation sends them no
-- Activity notices. Nobody is told. Account deletion already removes a member's own mutes. The demo
-- schema's copy gets the same check. Safe to re-run.
ALTER TABLE IF EXISTS member_mutes DROP CONSTRAINT IF EXISTS member_mutes_kind_check;
ALTER TABLE IF EXISTS member_mutes
  ADD CONSTRAINT member_mutes_kind_check CHECK (kind IN ('person', 'post', 'words'));

ALTER TABLE IF EXISTS demo.member_mutes DROP CONSTRAINT IF EXISTS member_mutes_kind_check;
ALTER TABLE IF EXISTS demo.member_mutes
  ADD CONSTRAINT member_mutes_kind_check CHECK (kind IN ('person', 'post', 'words'));
