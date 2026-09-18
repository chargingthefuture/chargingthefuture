-- Which Quora profiles have signed up more than once, and what each of those accounts got.
--
-- Written for the owner to paste into the Neon dashboard. Read-only: it changes nothing, grants
-- nothing and revokes nothing. Safe to run before or after the canonical-URL migration
-- (0028_unlock_canonical_quora_profile_urls.sql), because it canonicalizes in the query itself —
-- which is how it can find duplicates that the stored column still spells differently.
--
-- Why it is needed: until 2026-09-18 a stored "normalized" URL kept whatever scheme, www, casing and
-- trailing path the member typed, so three sign-ups on one profile were three unrelated-looking
-- rows. See the migration for the full account.
--
-- Reading the result: one block of rows per profile that has more than one account. `reward` says
-- whether that account collected the verification reward — more than one 'granted' on the same
-- profile is a reward that went out more than once for one identity, which an admin can claw back
-- with Revoke reward on that account's card in the Unlock queue.

WITH canonical AS (
  SELECT
    'https://www.quora.com/profile/'
      || lower(substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)')) AS profile,
    user_id,
    quora_profile_url AS submitted_as,
    review_status,
    access_tier,
    created_at,
    CASE
      WHEN reward_revoked_at IS NOT NULL THEN 'revoked'
      WHEN incentive_granted_at IS NOT NULL THEN 'granted'
      WHEN reward_withheld_at IS NOT NULL THEN 'withheld'
      ELSE 'none'
    END AS reward
  FROM unlock_verification_submissions
  WHERE substring(quora_profile_url_normalized from 'quora\.com/profile/([^/?#]+)') IS NOT NULL
),
duplicated AS (
  SELECT profile
    FROM canonical
   GROUP BY profile
  HAVING COUNT(*) > 1
)
SELECT
  c.profile,
  c.user_id,
  c.submitted_as,
  c.review_status,
  c.access_tier,
  c.reward,
  c.created_at::date AS signed_up
FROM canonical c
JOIN duplicated d ON d.profile = c.profile
ORDER BY c.profile, c.created_at;
