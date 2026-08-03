# Stream Quota Impact — say why a chat message was refused

Change: `fix: say why a Direct Line message was refused instead of only "Unauthorized"`.
Touches `ctf/packages/web/lib/socket-relay/stream.ts`,
`ctf/packages/web/lib/shared/stream-chat-send-state.ts`, and
`ctf/packages/web/components/shared/stream-chat-panel.tsx`, which is why the Stream quota gate requires
this note.

## Summary

Sending on a SocketRelay Direct Line still failed with "Message Failed · Unauthorized" after the
connection fix. That wording is the chat library's label for any send Stream refuses with an HTTP 403 —
the sender is not a member of the conversation, the conversation is frozen, the sender is banned, or the
app hit a plan limit — and the library discards Stream's own explanation, so neither the member nor the
logs learn which one it was. This change keeps the explanation: the panel reads the member's
capabilities when the conversation opens, replaces the composer with a plain reason when posting is not
allowed, shows the reason Stream gave when a send is refused, and records both. On the server, the
SocketRelay chat route now confirms Stream really holds both participants as members and records it when
it does not. No new chat activity is produced.

## Stream Surfaces Affected

- Stream Chat only. One extra server-side `queryMembers` read per Direct Line open, alongside the
  existing channel-ensure calls on that same route.
- The browser-side capability read is free: the capability list already arrives in the response to the
  `watch()` call the panel makes today. No extra request.
- The send itself is unchanged — the same single `sendMessage` call, made by us instead of by the
  library, so the error can be read. No retry loop is added.
- No change to Video, Activity Feeds, or AI Moderation.

## Estimated Monthly Impact

Negligible. `queryMembers` is one lightweight read per Direct Line open — a member-initiated action
measured in tens to low hundreds per month at current usage — and it creates no user, channel, message,
or connection. Chat is billed on monthly active users, which this does not change: it adds no new Stream
identity and no new connection.

## Budget Threshold Risk

None. Chat quota is billed on MAU (2,000/month on the Maker tier); this change adds zero MAU. The added
read is well inside normal API allowance and is bounded by how often a member opens a conversation.

## Fallback and Degradation Plan

Every added step is best-effort and cannot break a conversation:

- The membership verification is wrapped so a failed read is recorded and ignored — the conversation
  still opens.
- A missing or unreadable capability list is treated as "allowed to post", so the composer is never
  taken away because of unexpected response data.
- The send wrapper rethrows the original error after recording it, so the failed-message UI and its
  retry behave exactly as before.

## Observability

This change is mostly observability. New reports (`reportError`, visible in runtime logs and Sentry):

- `area: chat, op: send_capability_missing` — the member may read but not post; carries the capability
  list, the frozen flag, the channel id, and the first characters of the Stream app key.
- `area: chat, op: send_message` — a refused send; carries the HTTP status, Stream's numeric code, and
  Stream's own message.
- `area: socket-relay, op: verify_channel_members` — Stream does not hold both participants as members,
  or the channel is frozen; carries the missing ids and the member count.

No secret is recorded: only the first characters of the API key, which is public by design.

## Validation

`@ctf/web` typecheck, eslint, unit tests (10 new cases covering the refusal wording), and the full build
pass. EOF and drift gates pass. After deploy, opening the affected Direct Line names the cause on screen
rather than showing the bare "Unauthorized".
