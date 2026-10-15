-- New wording on the GDP and SkillUp tiles in the apps list.
--
-- The GDP tile stated a $300B dollar figure. GDP is a unitless index in the app, and the only place a
-- dollar figure for it may appear is the Workforce overview's Skills Economy Summary card. The
-- SkillUp tile said learners earn credits at each milestone. A learner's own held deposit comes back
-- at each milestone; new credits go to the trainer, not the learner.
--
-- schema.sql carries the same text in its registry seed. This sets it on an existing database too.
-- It changes only these two summaries, and only while they still differ, so a second run changes
-- nothing.
UPDATE ctf_plugin_registry
SET summary = 'Real time global survivor economic tracker. Your contributions counted, recorded, visible.',
    updated_at = NOW()
WHERE plugin_slug = 'gdp'
  AND summary IS DISTINCT FROM 'Real time global survivor economic tracker. Your contributions counted, recorded, visible.';

UPDATE ctf_plugin_registry
SET summary = 'Skills-training cohorts with a trainer. Your credit deposit is held and comes back to you as you reach each milestone.',
    updated_at = NOW()
WHERE plugin_slug = 'skill-up'
  AND summary IS DISTINCT FROM 'Skills-training cohorts with a trainer. Your credit deposit is held and comes back to you as you reach each milestone.';
