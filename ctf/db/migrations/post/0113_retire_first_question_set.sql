-- Safe to re-run.
-- 21 Questions: the first list of questions, q01 to q42, was retired on 2026-11-22 (owner decision)
-- and replaced by q43 onward. This deletes every answer to the old questions and their audit rows,
-- so nothing about them is kept. Their ids are never reused, so no new answer is touched. The demo
-- schema seeds no 21 Questions tables, so it has nothing to delete.
DELETE FROM question_answers
 WHERE question_id ~ '^q(0[1-9]|[1-3][0-9]|4[0-2])$';
DELETE FROM question_answer_audit
 WHERE question_id ~ '^q(0[1-9]|[1-3][0-9]|4[0-2])$';
