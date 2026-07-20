# Notifications — Profile and Deletion Contract

## Scope

The notifications center is cross-cutting: it holds a member-facing feed of notify-worthy events
produced by other plugins, plus each member's device-push opt-ins. It owns no profile of its own and
reuses the canonical Clerk user id (`user_id`) as the key on both of its tables.

## Owned tables

| Table | Key | Deletion on account removal |
|---|---|---|
| `notifications` | `user_id` | Hard delete all rows for the member. |
| `notification_preferences` | `user_id` (PK) | Hard delete the member's row. |

Both are registered in `ctf/packages/web/lib/account/deletion-registry.ts` under slug
`notifications`. There is no per-service deletion scope (`serviceScopeSupported: false`) — a member
cannot "leave notifications" as a standalone service; the data clears with the account.

## Privacy posture

- A notification row stores only a reference (`source_plugin`, `notification_type`, `target_ref`), a
  short neutral `summary`, and an in-app `link_path`. It never stores sensitive detail, so a leaked
  or exported row reveals nothing beyond the short summary the member already saw in-app.
- The in-app feed is always available to the signed-in member and is never gated by push
  preferences. Only device push (a future delivery step) is gated, and it defaults to off per
  category with `discreet_push` on (generic ping text, no plugin name or content on a lock screen) —
  the trauma-informed default for shared or monitored devices.
- When the underlying object a notification points at is gone or the member has lost access to it,
  the summary still reads harmlessly (it is a past-tense statement), and the `link_path` target
  applies its own access check on open.
