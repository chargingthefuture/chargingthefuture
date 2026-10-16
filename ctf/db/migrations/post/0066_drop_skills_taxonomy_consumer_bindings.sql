-- Drop skills_taxonomy_consumer_bindings and the view built on it, skills_taxonomy_dependency_graph.
--
-- Why (owner decision, 2026-10-16; issue #2801): nothing ever wrote a row to the table. Its one
-- reader was the admin dependency-impact preview, which no screen called, and which summed this
-- empty table and so reported a skill as safe to delete while members held it. The preview route is
-- removed in the same change. Taxonomy changes go through scripts/lib/applyTaxonomyChange.mjs,
-- which counts the live references itself.
--
-- The view goes first because it depends on the table. The demo schema's copies go too. Safe to
-- re-run: every statement is guarded by IF EXISTS, so a second run, or a database without a demo
-- schema, changes nothing.
DROP VIEW IF EXISTS skills_taxonomy_dependency_graph;
DROP TABLE IF EXISTS skills_taxonomy_consumer_bindings;

DROP VIEW IF EXISTS demo.skills_taxonomy_dependency_graph;
DROP TABLE IF EXISTS demo.skills_taxonomy_consumer_bindings;
