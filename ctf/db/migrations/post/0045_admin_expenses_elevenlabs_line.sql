-- Add the ElevenLabs line to /admin/expenses (added 2026-10-01).
--
-- Why: the owner subscribes to ElevenLabs (Creator plan, billed monthly through the App Store) to
-- make the audio versions of blog posts. It is not on the starting list in post/0041, and post/0041
-- no longer writes once the list has been edited, so the line needs its own step.
--
-- What it writes: one recurring, fixed-price line with what it pays for and a note that some months
-- are skipped. No amount: what each line costs is the owner's own data and is entered on the screen,
-- never in this repository, which is public (same rule as post/0041).
--
-- Safe to re-run: it writes only when no line for ElevenLabs exists yet and the audit trail holds
-- nothing for this line's fixed id. So a re-run (every qualifying push runs post/) never adds a
-- second ElevenLabs line next to one entered by hand, and never brings the line back after it was
-- removed on the screen. ON CONFLICT DO NOTHING covers two runs landing at once.
INSERT INTO admin_expenses (id, provider, purpose, kind, billing, notes)
SELECT
  '5e0a1c00-0000-4000-8000-000000000012'::uuid,
  'ElevenLabs',
  'Text to speech for the audio versions of blog posts',
  'recurring',
  'fixed',
  'Creator plan, billed monthly through the App Store. Some months are skipped: mark it stopped for a month it is not renewed.'
WHERE NOT EXISTS (SELECT 1 FROM admin_expenses WHERE lower(provider) = 'elevenlabs')
  AND NOT EXISTS (
    SELECT 1 FROM admin_expenses_audit_trail
    WHERE target_id = '5e0a1c00-0000-4000-8000-000000000012'
  )
ON CONFLICT (id) DO NOTHING;
