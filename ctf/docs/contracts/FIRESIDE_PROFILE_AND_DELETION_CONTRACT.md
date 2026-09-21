# Fireside — profile and deletion contract

Fireside holds no profile of its own. It stores what a member wrote, the name printed beside it, and
the reactions they left.

## What is stored

| Table | Personal data it holds |
|---|---|
| `fireside_comments` | `author_user_id`, `author_username` (the name printed beside the comment, written at creation), `body`, `edited_at` (when the author last rewrote it, which is the "edited" mark and nothing more — the earlier wording is not kept), `withdrawn_body` (the author's own copy of a comment they took down — returned only on `/api/fireside/mine`, never by the public thread read or the blog export feed) |
| `fireside_reactions` | `reactor_user_id` |
| `fireside_threads` | Nothing personal — a post reference and a title |
| `fireside_audit_events` | `actor_id` on each recorded write |

## Deleting your account

Fireside carries the same rights as the Commons, from the same screen in the account area (owner
decision, 2026-09-13). Deleting an account removes every comment and every reaction:
`deleteAllForUser` in `lib/fireside/repository.ts` deletes from `fireside_reactions` and
`fireside_comments` for that user id. Threads are left, because a thread is a reference to a blog
post rather than anything about a person; an empty one holds nothing.

Audit rows are kept, the same as every other plugin's audit trail — they record that a command ran,
not what was said.

## Taking one comment down

Separate from account deletion and available at any time. The author withdraws it, `body` is
emptied, and the row stays so that a reply underneath does not lose its parent. A withdrawn comment
is never shown to anybody else, never exported, and cannot be restored by an admin. The screen asks
before doing it, because it cannot be undone.

The words are copied to `withdrawn_body` first, which is the author's own copy and nobody else's.
It is read by one query — `listOwnComments`, scoped to the caller's own rows — and it is not in the
select that feeds the public thread read, so there is no shape that could return it to anybody
else. Deleting the account still takes it, because that deletes the entire row.

This is a deliberate narrowing of what withdrawal destroys, decided 2026-09-14 on an owner report:
taking a comment down cannot be undone, so the moment somebody most needs to read what they wrote
is just after they have destroyed it, when they are checking whether they meant that one. What
withdrawal means to everybody else is unchanged.

## Rewriting a comment

The author can rewrite their own comment at any time, the same way the Commons lets somebody rewrite
an announcement reply. The row keeps its id, so the replies under it and the reactions on it survive
— which taking it down and writing it again does not.

**No earlier wording is kept.** The new text replaces `body` outright: there is no version history
in this plugin, no copy of the previous words in another column, and nothing about them in the audit
row, which records that a comment was edited and when. So an edit is not a second copy of anything a
member wrote, and deletion has nothing extra to reach. `edited_at` is the mark that a comment is not
what it first said; it carries no text.

One thing an edit does move: a comment an admin had already approved for the blog goes back to
waiting. The approval was given to the words, and the words changed.

## The one thing deletion cannot reach

A comment that has been copied into the blog's published build is in a static site and captured by
the Internet Archive. That capture is not ours to edit, and deleting the row here does not remove it
from a web archive.

Two separate people have to agree before a comment can get there. The author asks, which is off by
default and never granted by anyone else, because the words are theirs and permanence is their call.
An admin then approves, because the build is a public page beside the project's own writing and an
account opened to post spam or bait could otherwise place text there that nobody can take back. The
author can withdraw the ask at any point before the copy is made, approval or no approval.

Everything in this plugin is deletable except what somebody deliberately asked to make permanent and
an admin agreed to, and the screen that offers the choice says so before it is made.
