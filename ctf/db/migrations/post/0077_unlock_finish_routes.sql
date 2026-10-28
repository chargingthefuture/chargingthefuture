-- post/0077: Unlock finishes by any of three routes (3.1.0 plan, Access).
--
-- A live Quora profile address, a removed account the member reported in the Quora account removals
-- survey, or Quora writing brought into the Knowledge Library. finish_route records which, and
-- finish_evidence_id the survey response or contribution behind it, so the reviewer knows what to
-- check. Every existing submission is the live-profile route. Production and the demo schema.
-- Safe to re-run.

ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS finish_route TEXT NOT NULL DEFAULT 'quora_profile';
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS finish_evidence_id TEXT;
DO $$
BEGIN
  IF to_regclass('public.unlock_verification_submissions') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unlock_verification_submissions_finish_route_check'
                       AND conrelid = 'public.unlock_verification_submissions'::regclass) THEN
    ALTER TABLE public.unlock_verification_submissions ADD CONSTRAINT unlock_verification_submissions_finish_route_check
      CHECK (finish_route IN ('quora_profile', 'removed_account', 'knowledge_library'));
  END IF;
END $$;

ALTER TABLE IF EXISTS demo.unlock_verification_submissions ADD COLUMN IF NOT EXISTS finish_route TEXT NOT NULL DEFAULT 'quora_profile';
ALTER TABLE IF EXISTS demo.unlock_verification_submissions ADD COLUMN IF NOT EXISTS finish_evidence_id TEXT;
