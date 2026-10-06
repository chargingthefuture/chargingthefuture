-- post/0051: A deleted comment no longer takes the replies under it.
--
-- fireside_comments.parent_comment_id was declared ON DELETE CASCADE. Account deletion removes a
-- member's comments with a plain DELETE, so Postgres also deleted every reply other members had
-- written under them, and the reactions on those replies. Those replies belong to people who
-- deleted nothing. Account deletion now empties and keeps a comment somebody answered, so its
-- replies keep their parent; this key, ON DELETE SET NULL from here on, is the backstop, so any
-- comment row that is deleted leaves the replies under it on the post as comments of their own.
--
-- Guarded: acts only while the key on parent_comment_id still cascades, so a re-run, or a database
-- created from the current schema.sql, does nothing. The constraint is found by its column rather
-- than by name, so a database whose key carries a different generated name is fixed too.
DO $$
DECLARE
  fk_name text;
BEGIN
  IF to_regclass('fireside_comments') IS NULL THEN
    RAISE NOTICE 'fireside_comments does not exist in this database; nothing to do.';
    RETURN;
  END IF;

  SELECT con.conname INTO fk_name
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
   WHERE con.conrelid = to_regclass('fireside_comments')
     AND con.contype = 'f'
     AND con.confdeltype = 'c'
     AND array_length(con.conkey, 1) = 1
     AND att.attname = 'parent_comment_id'
   LIMIT 1;

  IF fk_name IS NULL THEN
    RAISE NOTICE 'fireside_comments.parent_comment_id does not cascade on delete; nothing to change.';
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE fireside_comments DROP CONSTRAINT %I', fk_name);
  ALTER TABLE fireside_comments
    ADD CONSTRAINT fireside_comments_parent_comment_id_fkey
    FOREIGN KEY (parent_comment_id) REFERENCES fireside_comments(id) ON DELETE SET NULL;
  RAISE NOTICE 'fireside_comments.parent_comment_id now sets NULL on delete (was %).', fk_name;
END $$;
