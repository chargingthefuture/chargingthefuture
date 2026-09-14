# Fireside — profile and deletion contract

Fireside holds no profile of its own. It stores what a member wrote, the name printed beside it, and
the reactions they left.

## What is stored

| Table | Personal data it holds |
|---|---|
| `fireside_comments` | `author_user_id`, `author_username` (the name printed beside the comment, written at creation), `body` |
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

Separate from account deletion and available at any time. The author withdraws it, the body is
emptied, and the row stays so that a reply underneath does not lose its parent. A withdrawn comment
is never shown to anybody, never exported, and cannot be restored by an admin.

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
