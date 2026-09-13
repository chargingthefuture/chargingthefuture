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

A comment the author chose to export into the blog's published build has been copied into a static
site and captured by the Internet Archive. That capture is not ours to edit, and deleting the row
here does not remove it from a web archive.

This is why export is off by default and why only the author can turn it on. Everything in this
plugin is deletable except what somebody deliberately asked to make permanent, and the screen that
offers the choice says so before they make it.
