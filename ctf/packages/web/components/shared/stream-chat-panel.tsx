import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Thread,
  Window,
  useChannelActionContext,
  useChannelStateContext,
  type CustomMessageActions,
  type MessageActionsArray,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import './stream-chat-panel.css';

// How far ahead the "Remind me about this" action schedules its nudge (30 minutes).
const REMINDER_DELAY_MS = 30 * 60 * 1000;

// Message actions offered on every chat that uses this panel: the default Stream set MINUS 'edit'.
// The product forbids in-place edits (a silent history rewrite that keeps the original timestamp) —
// to change a message you delete it and repost, so a correction is a fresh message with a new
// timestamp. Delete stays, so "edit" is delete + repost. Keep this list in sync with Stream's
// defaults (add any new built-in action here) so removing edit never quietly drops another action.
const MESSAGE_ACTIONS_NO_EDIT: MessageActionsArray = [
  'delete',
  'flag',
  'markUnread',
  'mute',
  'pin',
  'quote',
  'react',
  'reply',
];

// Shared Stream connection registry, keyed by API key. `StreamChat.getInstance(apiKey)` returns one
// singleton client per key, so several StreamChatPanels on screen at once (e.g. a Beacon viewer plus a
// plugin chat) share the SAME client. Previously each panel called connectUser on mount and
// disconnectUser on unmount, so the first panel to unmount tore the connection out from under every
// other live panel, and a quick re-mount (React StrictMode, a token refresh) could connect twice.
// Ref-count the connection instead: connect once for the first panel, and only disconnect when the
// LAST panel using that client unmounts. Worst case is a connection kept alive slightly too long (a
// benign leak until page unload), never one dropped while still in use.
const streamConnections = new Map<string, { userId: string; count: number; ready: Promise<StreamChat> }>();

function acquireStreamConnection(apiKey: string, userId: string, token: string): Promise<StreamChat> {
  const client = StreamChat.getInstance(apiKey);
  const existing = streamConnections.get(apiKey);
  if (existing && existing.userId === userId) {
    existing.count += 1;
    return existing.ready;
  }
  // No live connection for this key, or it is connected as a different user: (re)connect. Guard
  // connectUser so we never call it when the client is already connected as this user.
  const ready = Promise.resolve()
    .then(() => (client.userID && client.userID !== userId ? client.disconnectUser() : undefined))
    .then(() => (client.userID === userId ? undefined : client.connectUser({ id: userId }, token)))
    .then(() => client);
  streamConnections.set(apiKey, { userId, count: 1, ready });
  return ready;
}

function releaseStreamConnection(apiKey: string): void {
  const entry = streamConnections.get(apiKey);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count <= 0) {
    streamConnections.delete(apiKey);
    // Best-effort teardown once nothing is using the shared client anymore.
    StreamChat.getInstance(apiKey).disconnectUser().catch(() => {});
  }
}

// The logged-in author's own messages are always gray; everyone else's use the plugin accent.
const OWN_BUBBLE_BG = 'rgba(255, 255, 255, 0.07)';

// Pick a readable text color (near-black or white) for text sitting on the accent bubble, by the
// accent's luminance — so a light accent (e.g. amber) gets dark text and a saturated one gets white.
function readableTextOn(color: string): string {
  const hex = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#FFFFFF';
}

// One in-channel search hit: enough to render a result row and jump to that message in the open list.
interface SearchHit {
  id: string;
  text: string;
  authorName: string;
}

// The fields read off each search result's message. channel.search returns Stream's MessageResponse;
// only these are needed here, so the result rows are narrowed to this local shape.
interface SearchResultMessage {
  id: string;
  text?: string;
  user?: { id: string; name?: string } | null;
}

// In-channel message search. It sits at the top of the Window, above the message list, so a member
// can search the conversation they are already reading. It takes the live channel from
// ChannelStateContext and jumps to a chosen result through ChannelActionContext — both are provided
// by the surrounding <Channel>. channel.search(query, options) scopes to this channel's own id
// automatically (stream-chat 8.x), so no cross-channel filter is needed; passing a string runs a
// full-text search within just this channel and returns { results: [{ message }] }.
const ChannelSearchBar: React.FC = () => {
  const { channel } = useChannelStateContext('ChannelSearchBar');
  const { jumpToMessage } = useChannelActionContext('ChannelSearchBar');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const runSearch = useCallback(async () => {
    const term = query.trim();
    if (!term) {
      setHits([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const response = await channel.search(term, { limit: 25, sort: { created_at: -1 } });
      // channel.search returns SearchAPIResponse: { results: [{ message }] }. The channel value is
      // loosely typed in this panel, so the relevant fields are narrowed to a small local shape here
      // rather than the full Stream generic — only id, text, and the author are read.
      const results = response.results as Array<{ message: SearchResultMessage }>;
      const next: SearchHit[] = results.map((result) => {
        const message = result.message;
        const authorName = message.user?.name || message.user?.id || 'Member';
        return { id: message.id, text: message.text || '(no text)', authorName };
      });
      setHits(next);
      setSearched(true);
    } catch {
      setHits([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }, [channel, query]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runSearch();
  };

  const onPickHit = (messageId: string) => {
    void jumpToMessage(messageId);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="ctf-chat-search ctf-chat-search--collapsed">
        <button
          type="button"
          className="ctf-chat-search__toggle"
          onClick={() => {
            setOpen(true);
            // Focus the input on the next paint, once it is rendered.
            window.requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-label="Search this conversation"
        >
          Search
        </button>
      </div>
    );
  }

  return (
    <div className="ctf-chat-search">
      <form className="ctf-chat-search__form" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          className="ctf-chat-search__input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this conversation"
          aria-label="Search this conversation"
        />
        <button type="submit" className="ctf-chat-search__submit" disabled={searching}>
          {searching ? '…' : 'Go'}
        </button>
        <button
          type="button"
          className="ctf-chat-search__close"
          onClick={() => {
            setOpen(false);
            setQuery('');
            setHits([]);
            setSearched(false);
          }}
          aria-label="Close search"
        >
          ×
        </button>
      </form>
      {searched && (
        <div className="ctf-chat-search__results" role="listbox">
          {hits.length === 0 ? (
            <div className="ctf-chat-search__empty">No messages found.</div>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                className="ctf-chat-search__hit"
                role="option"
                aria-selected={false}
                onClick={() => onPickHit(hit.id)}
              >
                <span className="ctf-chat-search__hit-author">{hit.authorName}</span>
                <span className="ctf-chat-search__hit-text">{hit.text}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// A message a member asked to be reminded about, plus the timer that fires the reminder. The timer id
// is kept so the reminder can be cancelled on unmount and never fires into a torn-down panel.
interface ActiveReminder {
  id: string;
  label: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

// A small one-line confirmation that floats over the message list after a member sets or fires a
// reminder, then clears itself. It uses the plugin accent variables so it matches the rest of the
// panel and never blocks the conversation underneath.
const ReminderToast: React.FC<{ text: string; onDismiss: () => void }> = ({ text, onDismiss }) => (
  <div className="ctf-chat-reminder-toast" role="status">
    <span className="ctf-chat-reminder-toast__text">{text}</span>
    <button
      type="button"
      className="ctf-chat-reminder-toast__close"
      onClick={onDismiss}
      aria-label="Dismiss reminder"
    >
      ×
    </button>
  </div>
);

// Builds the conversation's message-action menu and reminder behavior, scoped to one channel.
//
// stream-chat-react 12.16 / stream-chat 8.60 do not yet ship Stream's server-backed message
// reminders (the per-message reminder API — client.reminders / message.reminder — and the built-in
// "remind me" action arrived in stream-chat 9.x and stream-chat-react 13.x). Until that upgrade, this
// surfaces the same member-facing capability locally: a "Remind me about this" entry in each
// message's actions menu that schedules an in-browser nudge (a desktop notification when the member
// has granted permission, otherwise an in-panel toast). The reminder is gated on the channel's own
// `reminders` config flag, so it only appears when the channel type permits reminders and is simply
// absent — never a crash — when it does not.
//
// Returns the customMessageActions map to hand to <MessageList /> (empty when reminders are off, which
// MessageList treats as "no extra actions"), plus the live toast node to render over the list.
function useReminderActions(
  // The Stream Channel value is loosely typed throughout this panel; only getConfig() is read here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: any,
): { customMessageActions: CustomMessageActions; toast: React.ReactNode } {
  const [toastText, setToastText] = useState<string | null>(null);
  const remindersRef = useRef<ActiveReminder[]>([]);

  // The channel type permits reminders only when its config says so; getConfig() reads the watched
  // channel's config without a network call. When it is false (or the config is missing) the action
  // is not offered at all, so the panel degrades gracefully on channels without the capability.
  const remindersEnabled = Boolean(channel?.getConfig?.()?.reminders);

  // Clear any still-pending reminder timers when the panel unmounts so none fire after teardown.
  useEffect(() => {
    return () => {
      for (const reminder of remindersRef.current) clearTimeout(reminder.timeoutId);
      remindersRef.current = [];
    };
  }, []);

  const fireReminder = useCallback((label: string) => {
    const body = label ? `Reminder: ${label}` : 'Reminder about a message you saved.';
    // Use a desktop notification when the member has already granted permission; otherwise fall back
    // to the in-panel toast. Never prompt for permission here — that belongs to an explicit opt-in,
    // not a side effect of setting a reminder.
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('Direct Line reminder', { body });
        return;
      } catch {
        // Fall through to the toast if the notification cannot be constructed.
      }
    }
    setToastText(body);
  }, []);

  const customMessageActions = useMemo<CustomMessageActions>(() => {
    const actions: CustomMessageActions = {};
    if (!remindersEnabled) return actions;
    // The key is the label shown in the message actions menu; the handler schedules the nudge.
    actions['Remind me about this'] = (message) => {
      const preview = (message?.text || '').trim();
      const label = preview.length > 80 ? `${preview.slice(0, 77)}…` : preview;
      const timeoutId = setTimeout(() => {
        fireReminder(label);
        remindersRef.current = remindersRef.current.filter((r) => r.id !== message.id);
      }, REMINDER_DELAY_MS);
      // Replace any existing reminder for the same message so it cannot stack duplicates.
      const existing = remindersRef.current.find((r) => r.id === message.id);
      if (existing) clearTimeout(existing.timeoutId);
      remindersRef.current = [
        ...remindersRef.current.filter((r) => r.id !== message.id),
        { id: message.id, label, timeoutId },
      ];
      setToastText('Reminder set — you’ll be nudged about this message in 30 minutes.');
    };
    return actions;
  }, [remindersEnabled, fireReminder]);

  // Auto-clear the toast a few seconds after it appears so it never lingers over the conversation.
  useEffect(() => {
    if (!toastText) return;
    const timer = setTimeout(() => setToastText(null), 5000);
    return () => clearTimeout(timer);
  }, [toastText]);

  const toast = toastText ? (
    <ReminderToast text={toastText} onDismiss={() => setToastText(null)} />
  ) : null;

  return { customMessageActions, toast };
}

// Replaces Stream's built-in empty state (a plain "No chats here yet…") for a fresh conversation with
// on-brand copy that matches the dark panel and its plugin accent. Stream renders this for a message
// list, a thread, or a channel list; only the message-list case is a member-facing empty conversation,
// so the branded card shows there and the other list types fall back to rendering nothing. `listType`
// is the only prop read, so it is narrowed locally rather than importing Stream's generic props type.
const ChatEmptyState: React.FC<{ listType?: 'channel' | 'message' | 'thread' }> = ({ listType }) => {
  if (listType && listType !== 'message') return null;
  return (
    <div className="ctf-chat-empty" role="status">
      <div className="ctf-chat-empty__icon" aria-hidden>
        <MessageCircle size={22} />
      </div>
      <div className="ctf-chat-empty__title">No messages yet</div>
      <div className="ctf-chat-empty__body">Send the first message to get the conversation going.</div>
    </div>
  );
};

// The live conversation under <Channel>: search bar, message list, composer, and thread panel, plus
// the reminder action wired into the message-action menu and its floating toast. It is a child of
// <Channel> so the Stream contexts (state, action) are available to ChannelSearchBar; it takes the
// channel directly to read the reminders config without another network call. Polls need no wiring
// here — see the comment on the <Window> block.
const ConversationBody: React.FC<{
  // The Stream Channel value is loosely typed throughout this panel; passed straight to the hook.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: any;
}> = ({ channel }) => {
  const { customMessageActions, toast } = useReminderActions(channel);
  return (
    <>
      {/* Window holds the main conversation; it yields to the Thread panel when a reply thread is
          open (the thread slides over on phone-width, sits beside on desktop). Wrapping the list +
          input in Window — and rendering a sibling Thread — is what turns on Stream's threaded
          replies. Reactions, the typing indicator, and read state come with the v12 MessageList
          defaults once the channel type allows them (the messaging type does).
          ChannelSearchBar sits at the top of the Window so in-channel search lives above the list.
          @mention autocomplete is the MessageInput default once members are loaded (see watch() in
          the panel), and link preview cards render in the MessageList via the default Attachment Card.
          Polls (create + vote) are entirely default in stream-chat-react 12.16: the composer's
          AttachmentSelector shows a "Create poll" entry whenever the channel config allows polls and
          the member holds the send-poll capability (uploads are off, so it is the only entry there),
          and MessageList renders the default Poll card with live voting for any message that carries a
          poll. The owner enabled polls on the messaging channel type, so no extra wiring is needed; the
          affordance is simply absent on channels that do not permit polls. The reminder action is the
          only message action passed in — it is empty (no extra action) when the channel does not permit
          reminders. */}
      <div className="ctf-chat-conversation">
        <Window>
          <ChannelSearchBar />
          {/* messageActions is the default Stream set with 'edit' removed: the product forbids an
              in-place edit (a silent history rewrite that keeps the original timestamp). To change a
              message you delete it and repost, so a correction lands as a fresh message with a new
              timestamp. Delete and every other action stay. */}
          <MessageList customMessageActions={customMessageActions} messageActions={MESSAGE_ACTIONS_NO_EDIT} />
          <MessageInput />
        </Window>
        {toast}
      </div>
      <Thread />
    </>
  );
};

export interface StreamChatPanelProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
  channelType?: string;
  /** Plugin brand color used to tint Stream's accent (send button, links, active states). */
  accentColor?: string;
}

export const StreamChatPanel: React.FC<StreamChatPanelProps> = ({
  streamApiKey,
  streamToken,
  streamUserId,
  streamChannelId,
  channelType = 'messaging',
  accentColor,
}) => {
  const [client, setClient] = useState<StreamChat | null>(null);
  // The Stream Channel type is generically parameterized and impractical to satisfy here; the value is
  // only passed straight to <Channel channel={channel}>. TODO: type once stream-chat generics are pinned.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [channel, setChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    // Ref-counted shared connection (see streamConnections above) — connect once across all panels on
    // this API key, disconnect only when the last one unmounts.
    acquireStreamConnection(streamApiKey, streamUserId, streamToken)
      .then((chatClient) => {
        const ch = chatClient.channel(channelType, streamChannelId);
        // Watch with presence so the channel state carries its member list. The default '@' mention
        // trigger in MessageInput reads the channel members to suggest people, so members must be
        // loaded for autocomplete to offer anyone; watch() populates channel.state.members.
        return ch.watch({ presence: true }).then(() => {
          if (!isMounted) return;
          setChannel(ch);
          setClient(chatClient);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Failed to connect to chat.');
        setLoading(false);
      });
    return () => {
      isMounted = false;
      releaseStreamConnection(streamApiKey);
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId, channelType]);

  if (loading) return <div style={{ padding: 16, color: '#9CA3AF', fontSize: 14 }}>Loading chat…</div>;
  if (error) return <div style={{ padding: 16, color: '#EF4444', fontSize: 14 }}>{error}</div>;
  if (!client || !channel) return <div style={{ padding: 16, color: '#9CA3AF', fontSize: 14 }}>Chat unavailable.</div>;

  // The whole app is dark, so the chat must use Stream's dark theme (it used to render the light
  // theme, which looked like a white widget dropped into a dark plugin). The wrapper carries the
  // theme class and, when given, tints Stream's accent CSS variables to the plugin's brand color.
  const themeVars = {
    // Own messages are gray everywhere; other people's messages take the plugin accent (below).
    '--ctf-chat-own-bg': OWN_BUBBLE_BG,
    ...(accentColor
      ? {
          '--str-chat__primary-color': accentColor,
          '--str-chat__active-primary-color': accentColor,
          '--str-chat__message-send-color': accentColor,
          '--ctf-chat-other-bg': accentColor,
          '--ctf-chat-other-fg': readableTextOn(accentColor),
        }
      : {}),
  } as React.CSSProperties;

  return (
    <div className="str-chat__theme-dark" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...themeVars }}>
      <Chat client={client}>
        {/* enrichURLForPreview turns on URL enrichment in the composer: as a member types or pastes a
            link, Stream scrapes it and MessageInput shows a LinkPreviewList card before sending. The
            sent message then carries an og-scrape attachment, which the default Attachment renderer
            (Card) draws as a preview card in the MessageList — so pasted links get preview cards both
            while composing and in the conversation. The messaging channel type already permits URL
            enrichment in the dashboard, so no dashboard change is needed. */}
        <Channel channel={channel} enrichURLForPreview EmptyStateIndicator={ChatEmptyState}>
          <ConversationBody channel={channel} />
        </Channel>
      </Chat>
    </div>
  );
};
