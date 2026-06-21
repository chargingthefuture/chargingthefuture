import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import './stream-chat-panel.css';

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
    const chatClient = StreamChat.getInstance(streamApiKey);
    let isMounted = true;
    chatClient
      .connectUser({ id: streamUserId }, streamToken)
      .then(() => {
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
      chatClient.disconnectUser();
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
        <Channel channel={channel} enrichURLForPreview>
          {/* Window holds the main conversation; it yields to the Thread panel when a reply thread is
              open (the thread slides over on phone-width, sits beside on desktop). Wrapping the list +
              input in Window — and rendering a sibling Thread — is what turns on Stream's threaded
              replies. Reactions, the typing indicator, and read state come with the v12 MessageList
              defaults once the channel type allows them (the messaging type does).
              ChannelSearchBar sits at the top of the Window so in-channel search lives above the list.
              @mention autocomplete is the MessageInput default once members are loaded (see watch()
              above), and link preview cards render in the MessageList via the default Attachment Card. */}
          <Window>
            <ChannelSearchBar />
            <MessageList />
            <MessageInput />
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};
