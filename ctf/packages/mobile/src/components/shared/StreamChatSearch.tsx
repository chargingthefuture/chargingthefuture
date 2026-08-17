import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { reportError } from '../../observability/report';

// One in-channel search result row: enough to show who said what and when.
interface SearchHit {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}

// The fields read off each search result's message. channel.search returns Stream's MessageResponse;
// only these are needed here, so the result rows are narrowed to this small local shape.
interface SearchResultMessage {
  id: string;
  text?: string;
  created_at?: string;
  user?: { id: string; name?: string } | null;
}

export interface StreamChatSearchProps {
  // The live Stream Channel. It is loosely typed throughout the chat view (the Stream Channel generic
  // is impractical to satisfy here); only channel.search(...) is called on it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: any;
  // The plugin accent, used for the active affordance and result author labels so search matches the
  // rest of the chat.
  accentColor: string;
  // Called with a message id when a result is tapped, so the host can do something sensible with it
  // (the chat view shows the picked result; jumping the list to it is a bonus, not required).
  onSelectMessage?: (_messageId: string) => void;
}

// How many messages a single search returns. Search is user-initiated (one query per submit), so this
// caps each query's payload without paging — adequate for finding a recent message in a conversation.
const SEARCH_LIMIT = 25;

// In-channel message search for the mobile Direct Line chat. There is no drop-in search UI in
// stream-chat-react-native the way the web SDK has one, so this is a lightweight equivalent: a "Search"
// affordance expands into a text field; submitting runs channel.search(term) scoped to THIS channel
// (stream-chat scopes a string query to the channel it is called on) and lists the matches with author
// + timestamp. It handles the empty (nothing typed), no-results, loading, and error states. Tapping a
// result calls onSelectMessage so the host can react (jump-to-message is a bonus, not required).
export const StreamChatSearch: React.FC<StreamChatSearchProps> = ({
  channel,
  accentColor,
  onSelectMessage,
}) => {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);

  const runSearch = useCallback(async () => {
    const term = query.trim();
    if (!term) {
      setHits([]);
      setSearched(false);
      setFailed(false);
      return;
    }
    setSearching(true);
    setFailed(false);
    try {
      // A string query scopes to this channel's own messages (stream-chat 9.x); no cross-channel
      // filter is needed. The response is SearchAPIResponse: { results: [{ message }] }.
      const response = await channel.search(term, { limit: SEARCH_LIMIT, sort: { created_at: -1 } });
      const results = response.results as Array<{ message: SearchResultMessage }>;
      const next: SearchHit[] = results.map((result) => {
        const message = result.message;
        const authorName = message.user?.name || message.user?.id || 'Member';
        return {
          id: message.id,
          text: message.text || '(no text)',
          authorName,
          createdAt: message.created_at || '',
        };
      });
      setHits(next);
      setSearched(true);
    } catch (caught) {
      reportError(caught, { area: 'chyme', op: 'chat_search' });
      setHits([]);
      setSearched(true);
      setFailed(true);
    } finally {
      setSearching(false);
    }
  }, [channel, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHits([]);
    setSearched(false);
    setFailed(false);
  }, []);

  if (!open) {
    return (
      <View style={styles.collapsedRow}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Search this conversation"
          style={styles.toggle}
        >
          <Text style={[styles.toggleText, { color: accentColor }]}>Search</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search this conversation"
          placeholderTextColor="rgba(255,255,255,0.4)"
          accessibilityLabel="Search this conversation"
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => void runSearch()}
        />
        <Pressable
          onPress={() => void runSearch()}
          disabled={searching}
          accessibilityRole="button"
          accessibilityLabel="Run search"
          style={[styles.submit, { borderColor: accentColor }]}
        >
          {searching ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Text style={[styles.submitText, { color: accentColor }]}>Go</Text>
          )}
        </Pressable>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close search"
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      {searched && (
        <View style={styles.results}>
          {failed ? (
            <Text style={styles.message}>Search failed. Try again.</Text>
          ) : hits.length === 0 ? (
            <Text style={styles.message}>No messages found.</Text>
          ) : (
            <FlatList
              data={hits}
              keyExtractor={(hit) => hit.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelectMessage?.(item.id)}
                  accessibilityRole="button"
                  style={styles.hit}
                >
                  <View style={styles.hitHeader}>
                    <Text style={[styles.hitAuthor, { color: accentColor }]} numberOfLines={1}>
                      {item.authorName}
                    </Text>
                    {item.createdAt ? (
                      <Text style={styles.hitTime}>{formatTimestamp(item.createdAt)}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.hitText} numberOfLines={2}>
                    {item.text}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
};

// A short, locale-aware date+time for a result row; falls back to the raw value if it cannot be parsed.
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    collapsedRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    toggle: { paddingVertical: 4, paddingHorizontal: 8 },
    toggleText: { fontSize: 14, fontWeight: '600' },
    container: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    form: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      flex: 1,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: t.borderFaint,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      color: '#fff',
      fontSize: 14,
    },
    submit: {
      height: 40,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
    },
    submitText: { fontSize: 14, fontWeight: '600' },
    close: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 22, color: 'rgba(255,255,255,0.6)', lineHeight: 24 },
    results: { maxHeight: 240, marginTop: 8 },
    message: { paddingVertical: 12, color: 'rgba(255,255,255,0.6)', fontSize: 14 },
    hit: {
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginBottom: 4,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    hitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    hitAuthor: { flex: 1, fontSize: 13, fontWeight: '700' },
    hitTime: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
    hitText: { marginTop: 2, fontSize: 13, color: '#D1D5DB', lineHeight: 18 },
  });
}
