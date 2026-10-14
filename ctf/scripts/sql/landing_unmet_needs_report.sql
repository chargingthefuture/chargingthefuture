-- In-demand needs from the landing page, most asked first (owner view; paste into the Neon SQL
-- Editor). Each row in directory_unmet_needs is one visit where a need matched nobody. A need that
-- now has people still shows here with its history; "last_asked" says how recent the demand is.
SELECT need,
       COUNT(*) AS times_asked,
       MIN(created_at) AS first_asked,
       MAX(created_at) AS last_asked
FROM directory_unmet_needs
GROUP BY need
ORDER BY times_asked DESC, last_asked DESC;
