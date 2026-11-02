-- 21 Questions audit (owner view; paste into the Neon SQL Editor). Somebody who keeps switching
-- matching off and on, or keeps trying to give a different answer to a question already answered,
-- may be fishing for matches to reach people. Answers cannot be changed: the first one stands, so a
-- different one is refused and recorded as answer_refused. user_id is the Clerk account id; look it
-- up in the Clerk dashboard to see who it is.

-- 1. Who to look at: the last 30 days, most switching and refused attempts first.
SELECT user_id,
       COUNT(*) FILTER (WHERE action = 'matching_off') AS matching_off,
       COUNT(*) FILTER (WHERE action = 'matching_on') AS matching_on,
       COUNT(*) FILTER (WHERE action = 'answer_refused') AS answers_refused,
       COUNT(*) FILTER (WHERE action = 'answered') AS answered,
       MAX(created_at) AS last_seen
FROM question_answer_audit
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
HAVING COUNT(*) FILTER (WHERE action <> 'answered') > 0
ORDER BY COUNT(*) FILTER (WHERE action <> 'answered') DESC, last_seen DESC;

-- 2. One person's history, newest first. Replace the id between the quotes.
SELECT created_at, action, question_id, choice, prior_choice
FROM question_answer_audit
WHERE user_id = 'user_REPLACE_ME'
ORDER BY created_at DESC;
