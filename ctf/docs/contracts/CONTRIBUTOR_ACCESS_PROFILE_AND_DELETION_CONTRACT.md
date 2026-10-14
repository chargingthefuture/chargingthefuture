# Contributor Access — Profile and Deletion Contract

## What this plugin holds about a person

- An eligibility row (`contributor_access_eligibility`): whether the member has earned the Weavers
  of the Commons badge, when, and whether an admin has revoked or reinstated it. It is computed from
  activity elsewhere in the app and holds no content.
- Messages they wrote in the contributor channel (`contributor_access_channel_posts`) and their
  reactions to others' messages (`contributor_access_channel_post_reactions`). The app database is
  the message store; message text never enters Stream, which carries only presence and typing.

The configuration table (`contributor_access_config`) is global and names a member only as the
admin who last changed it. The audit trail (`contributor_access_audit_trail`) records admin actions
on the badge and moderator deletions in the channel.

## Deleting an account

Handled declaratively by the account-deletion engine
(`ctf/packages/web/lib/account/deletion-registry.ts`, slug `contributor-access`). Service-scoped
deletion is not offered for this plugin: the badge is earned, and the only thing a member could
delete on its own is the record that they earned it, which is what deleting the account does
anyway.

| Table | On deletion | Why |
|---|---|---|
| `contributor_access_channel_post_reactions` | Deleted, matched on `user_id` | The member's own reactions; removed before the posts they point at. |
| `contributor_access_channel_posts` | Deleted, matched on `author_user_id` | The member's own messages. |
| `contributor_access_eligibility` | Deleted, matched on `user_id` | Deleting the account resets the barrier. Somebody who deletes and returns earns the badge again, which is the answer to a bad actor who deletes to shed a revocation. |
| `contributor_access_audit_trail` | Retained | An admin who revoked or reinstated a badge, or removed a message, stays answerable for it after the account is gone. |
| `contributor_access_config` | Untouched | Global; the member appears only as the admin who last changed it. |

## What a deleted member leaves behind

Their messages disappear from the channel for everyone. A reply someone else wrote stays, and
reads as it did, because posts do not quote each other. A revocation recorded in the audit trail
stays as a row about an actor and a target id, and the target no longer resolves to a person.

## Coming back

A returning member has no badge and no history here. Eligibility is recomputed from their new
activity on the same schedule as everyone else's, and nothing written before is restored.
