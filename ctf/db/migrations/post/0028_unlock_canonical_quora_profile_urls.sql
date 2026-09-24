-- Unlock: re-key every stored Quora profile URL to one canonical form per profile.
--
-- Owner report, 2026-09-18: one Quora profile had signed up three times and nothing in the app said
-- so. The queue card for the account that was approved showed no "Shared by" pill, and the reward
-- was granted.
--
-- The cause was in normalizeQuoraProfileUrl (packages/web/lib/unlock/quora-url.ts), which stripped
-- the query and the hash and then returned the URL otherwise as the member typed it. So all of these
-- were stored as different "normalized" strings, though they are one person's profile:
--
--   https://www.quora.com/profile/Mary-T-I-1     (the share link the Quora app produces)
--   https://quora.com/profile/Mary-T-I-1
--   http://www.quora.com/profile/Mary-T-I-1
--   https://www.quora.com/profile/Mary-T-I-1/
--   https://www.quora.com/profile/Mary-T-I-1/answers
--   https://www.quora.com/profile/mary-t-i-1
--
-- Three things in Unlock exist to stop one person verifying twice, and all three decide by comparing
-- those strings: the "Shared by N" count on the queue card, the guard that withholds the
-- verification reward when another account already holds it for that identity, and the spam denylist
-- that keeps a known-bad profile out of the queue. Each missed a member who pasted the same profile
-- a slightly different way.
--
-- The code now canonicalizes to https://www.quora.com/profile/<lowercased slug>. This migration
-- rewrites the rows already stored, because a fixed function comparing against unfixed rows would
-- keep the same blindness for every member who signed up before today.
--
-- Nothing here approves, rejects, revokes or grants anything. It only re-keys. The duplicates it
-- brings to light appear as "Shared by N" on the queue, for a human to decide on — including any
-- reward already granted to a duplicate, which an admin revokes from the card as usual.
--
-- Re-runnable: canonicalizing an already-canonical value returns it unchanged, so a second run
-- updates nothing and merges nothing.
--
-- One transaction, added 2026-09-24 after this file deleted a denylist row it never put back. The
-- workflow reaches Neon through its connection pooler, which may hand each statement outside a
-- transaction to a different server session. The stash below is a TEMP table, visible only to the
-- session that created it, so on the 2026-09-24 run the DELETE ran and the INSERT that should have
-- restored the rows failed with `relation "unlock_spam_quora_urls_canonical" does not exist`: the
-- deleted row was committed as gone. Inside one transaction every statement runs on the session that
-- holds the stash, and a failure rolls the DELETE back. post/0040 restores what that run lost. As with
-- post/0027, this changes where the statements run, not what they do.
BEGIN;

-- 1) The submissions themselves. No unique constraint on this column (the table is keyed on
--    user_id), so several rows collapsing onto one canonical value is exactly what should happen.
UPDATE unlock_verification_submissions
   SET quora_profile_url_normalized =
         'https://www.quora.com/profile/'
         || lower(substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)')),
       updated_at = updated_at
 WHERE substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)') IS NOT NULL
   AND quora_profile_url_normalized <>
         'https://www.quora.com/profile/'
         || lower(substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)'));

-- 2) The spam denylist. This one IS keyed on the normalized URL, so two denylisted spellings of the
--    same profile have to merge rather than collide. Kept as separate statements (stash, delete,
--    re-insert) rather than one data-modifying CTE, because deleting and re-inserting the same key
--    inside a single statement can trip the unique index.
--
--    Merge rules: the flag counts add up (each flag was a real admin decision about this profile),
--    the first flag keeps the earliest timestamp and the last the latest, and the human-readable URL
--    and flagging admin come from the most recently flagged of the merged rows.
DROP TABLE IF EXISTS unlock_spam_quora_urls_canonical;
CREATE TEMP TABLE unlock_spam_quora_urls_canonical AS
SELECT
  'https://www.quora.com/profile/'
    || lower(substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)')) AS quora_profile_url_normalized,
  (array_agg(quora_profile_url ORDER BY last_flagged_at DESC, quora_profile_url))[1] AS quora_profile_url,
  (array_agg(flagged_by_user_id ORDER BY last_flagged_at DESC, quora_profile_url))[1] AS flagged_by_user_id,
  SUM(flag_count)::int AS flag_count,
  MIN(first_flagged_at) AS first_flagged_at,
  MAX(last_flagged_at) AS last_flagged_at
FROM unlock_spam_quora_urls
WHERE substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)') IS NOT NULL
GROUP BY 1;

DELETE FROM unlock_spam_quora_urls
 WHERE substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)') IS NOT NULL;

INSERT INTO unlock_spam_quora_urls (
  quora_profile_url_normalized,
  quora_profile_url,
  flagged_by_user_id,
  flag_count,
  first_flagged_at,
  last_flagged_at,
  updated_at
)
SELECT
  quora_profile_url_normalized,
  quora_profile_url,
  flagged_by_user_id,
  flag_count,
  first_flagged_at,
  last_flagged_at,
  NOW()
FROM unlock_spam_quora_urls_canonical;

DROP TABLE IF EXISTS unlock_spam_quora_urls_canonical;

COMMIT;
