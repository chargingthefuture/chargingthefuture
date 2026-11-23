-- post/0117: remove the Commons Q&A ("Feed Questions") tables.
--
-- Asking moved to Ask the architect (the comic plugin), and no screen calls the old question,
-- answer or rating routes any more; this change deletes those routes and their code. What they
-- stored goes with them: feed_questions, feed_answers, feed_answer_ratings, and llm_inference_log,
-- whose rows each point at a question and an answer and which nothing else ever wrote to. The
-- Commons timeline copies of questions (feed_items rows of type 'question') are deleted, which
-- removes their targets, read state and dismissals with them, and feed_items.source_question_id and
-- its unique index are dropped. The 'questions' channel is taken out of the stored feed settings
-- and the column default. Announcements and Commons posts are not touched.
--
-- Production and the demo schema. Safe to re-run: every step is guarded and the second run finds
-- nothing to do.

DELETE FROM feed_items WHERE item_type = 'question';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feed_items' AND column_name = 'source_question_id'
  ) THEN
    DELETE FROM public.feed_items WHERE source_question_id IS NOT NULL;
  END IF;
END $$;
DROP INDEX IF EXISTS public.idx_feed_items_source_question_unique;
ALTER TABLE IF EXISTS public.feed_items DROP COLUMN IF EXISTS source_question_id;

DROP TABLE IF EXISTS public.llm_inference_log;
DROP TABLE IF EXISTS public.feed_answer_ratings;
DROP TABLE IF EXISTS public.feed_answers;
DROP TABLE IF EXISTS public.feed_questions;

UPDATE public.feed_render_config
SET enabled_channels = enabled_channels - 'questions'
WHERE enabled_channels ? 'questions';
ALTER TABLE IF EXISTS public.feed_render_config
  ALTER COLUMN enabled_channels SET DEFAULT '["announcements", "community"]'::jsonb;

-- The demo schema holds the same tables (schema.demo.sql); clear them the same way.
DO $$
BEGIN
  IF to_regclass('demo.feed_items') IS NOT NULL THEN
    DELETE FROM demo.feed_items WHERE item_type = 'question';
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'demo' AND table_name = 'feed_items' AND column_name = 'source_question_id'
    ) THEN
      DELETE FROM demo.feed_items WHERE source_question_id IS NOT NULL;
    END IF;
  END IF;
  IF to_regclass('demo.feed_render_config') IS NOT NULL THEN
    UPDATE demo.feed_render_config
    SET enabled_channels = enabled_channels - 'questions'
    WHERE enabled_channels ? 'questions';
    ALTER TABLE demo.feed_render_config
      ALTER COLUMN enabled_channels SET DEFAULT '["announcements", "community"]'::jsonb;
  END IF;
END $$;
DROP INDEX IF EXISTS demo.idx_feed_items_source_question_unique;
ALTER TABLE IF EXISTS demo.feed_items DROP COLUMN IF EXISTS source_question_id;
DROP TABLE IF EXISTS demo.llm_inference_log;
DROP TABLE IF EXISTS demo.feed_answer_ratings;
DROP TABLE IF EXISTS demo.feed_answers;
DROP TABLE IF EXISTS demo.feed_questions;
