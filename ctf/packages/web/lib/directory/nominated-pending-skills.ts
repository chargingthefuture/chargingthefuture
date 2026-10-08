// The free-text skills a SkillsHunt nomination proposed, read from the nomination itself, for every
// profile that nomination generated. One row per profile and label still waiting on a taxonomy
// decision. Used for the profile's "pending review" chips and the admin Pending skill proposals list.
//
// Read from skills_hunt_submissions.proposed_skills, not from skills_hunt_proposed_skill_promotions.
// The tracker gets a row only when the scheduled proposal run files an issue, which needs API credit,
// and it keeps one row per distinct skill linked to the earliest nomination. Reading the tracker left
// an approved nomination with no chip and no list row until a funded run came by, and left every later
// nomination of an already-filed skill with none at all. The tracker is joined by label only for its
// decision: 'promoted' or 'dropped' ends the chip on every profile carrying that label.
//
// A label that already names an active taxonomy skill (or alias) is left out: approval linked it to
// the profile as a real skill (lib/skills-hunt/repository.ts), so it was never pending.
//
// Columns: profile_id (text), skill_label, submission_id, submitter_user_id, submitter_username,
// added_at. Ids compared as text, as directory_profile_id is text on the cloned production database.
export const NOMINATED_PENDING_SKILLS_SQL = `
  SELECT DISTINCT ON (shdp.directory_profile_id, lower(btrim(elem.value)))
    shdp.directory_profile_id::text AS profile_id,
    btrim(elem.value) AS skill_label,
    sub.id AS submission_id,
    sub.submitter_user_id,
    sub.submitter_username,
    shdp.created_at AS added_at
  FROM skills_hunt_directory_profiles shdp
  JOIN skills_hunt_submissions sub ON sub.id::text = shdp.submission_id::text
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(sub.proposed_skills) = 'array' THEN sub.proposed_skills ELSE '[]'::jsonb END
  ) AS elem(value)
  LEFT JOIN skills_hunt_proposed_skill_promotions decided
    ON decided.normalized_skill = lower(btrim(elem.value))
   AND decided.status IN ('promoted', 'dropped')
  WHERE btrim(elem.value) <> ''
    AND decided.id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM skills_taxonomy_skills tx
      WHERE tx.is_active
        AND (
          lower(btrim(tx.name)) = lower(btrim(elem.value))
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(tx.aliases) = 'array' THEN tx.aliases ELSE '[]'::jsonb END
            ) al(value)
            WHERE lower(btrim(al.value)) = lower(btrim(elem.value))
          )
        )
    )
  ORDER BY shdp.directory_profile_id, lower(btrim(elem.value)), btrim(elem.value)
`;
