# Stream Quota Impact — disable in-place edit in the shared Stream chat

Change: `fix: disable in-place message edit in the shared Stream chat (delete + repost only)`. Touches
`ctf/packages/web/components/shared/stream-chat-panel.tsx`, which is why the Stream quota gate requires
this note.

## Summary

Removed `edit` from the `messageActions` allow-list passed to Stream's `<MessageList>` so members can no
longer edit a chat message in place (delete + repost instead). This is a **client-side UI configuration**
of which action buttons render in the message menu. It sends nothing new to Stream and, if anything,
removes a category of Stream API call (the update-message call), so it can only reduce Stream usage.

## Stream Surfaces Affected

- Stream Chat message-action menu on every surface that uses the shared panel (Foundation, Lighthouse,
  SocketRelay, TrustTransport, Beacon viewer + host). No channel, token, message-volume, or Video
  change. Delete and all other actions are unchanged.

## Estimated Monthly Impact

Zero or slightly **negative**. No new tokens, channels, messages, participant-minutes, or API calls;
the only behavioral delta is the absence of update-message ("edit") calls, which is a reduction.

## Budget Threshold Risk

None. The change cannot increase Maker-tier quota usage.

## Fallback and Degradation Plan

Not applicable — it is a static UI prop. If Stream is degraded, chat degrades exactly as before; this
change adds no new failure path. To revert, restore `edit` to the `messageActions` list.

## Observability

No new metric. Stream's dashboard reflects the (slightly lower) message-mutation API volume; the app's
existing Stream error handling is unchanged.

## Validation

`@ctf/web` typecheck (validates the `messageActions` list against stream-chat-react v12) + eslint clean;
EOF check passes. Confirmed in-app: on a chat using the shared panel, the message menu on your own
message shows Delete but no Edit.
