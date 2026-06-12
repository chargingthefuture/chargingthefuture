import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import type { PeerProgrammingCohort, PeerProgrammingMessage, PeerProgrammingTopic } from './api';

const COLOR = '#6EE7B7';

type Props = {
  cohort: PeerProgrammingCohort;
  topic: PeerProgrammingTopic | null;
  messages: PeerProgrammingMessage[];
};

const MessageRow = ({ item }: { item: PeerProgrammingMessage }) => (
  <View style={styles.messageRow}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{item.authorUserId.slice(0, 2).toUpperCase()}</Text>
    </View>
    <View style={styles.messageBubble}>
      <Text style={styles.messageBody}>{item.body}</Text>
      <Text style={styles.messageTime}>
        {new Date(item.createdAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  </View>
);

export const PeerProgrammingSessionTab = ({ cohort, topic, messages }: Props) => (
  <View style={styles.root}>
    <View style={styles.sessionHeader}>
      <Text style={styles.sessionTitle}>{cohort.cohortLabel}</Text>
      {topic !== null && <Text style={styles.sessionSubtitle}>{topic.title}</Text>}
    </View>
    {messages.length === 0 ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No messages yet. Be the first to post in your cohort.</Text>
      </View>
    ) : (
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageRow item={item} />}
        contentContainerStyle={styles.messageList}
        style={styles.list}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  sessionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sessionTitle: { fontSize: 15, fontWeight: '700', color: '#F9FAFB', marginBottom: 2 },
  sessionSubtitle: { fontSize: 12, color: '#9CA3AF' },
  list: { flex: 1 },
  messageList: { padding: 16 },
  messageRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLOR}25`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: COLOR },
  messageBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
  },
  messageBody: { fontSize: 13, color: '#E8EAF0', lineHeight: 18, marginBottom: 4 },
  messageTime: { fontSize: 10, color: '#6B7280' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
