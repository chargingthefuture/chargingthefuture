import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trust } from '../trust';
import { mobileFeedItems } from '../../mocks/feedDemoData';

const posts = mobileFeedItems.filter((item) => item.channel === 'community');

export const MockCommunity = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Community Support Channel</Text>
    <Text style={styles.subtitle}>Mobile parity shell for peer posts, replies, and moderation-ready actions.</Text>

    {/* Trust Panel (Android parity) */}
    <Trust />

    {posts.map((item) => (
      <React.Fragment>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.meta}>{item.category ?? 'general'}</Text>
          <Text style={styles.cardBody}>{item.body}</Text>
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>Replies</Text>
            {item.replies?.map((reply) => (
              <React.Fragment>
                <Text style={styles.replyBody}>{reply.body}</Text>
              </React.Fragment>
            ))}
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.actionPill}>
              <Text style={styles.actionText}>Reply</Text>
            </Pressable>
            <Pressable style={styles.actionPill}>
              <Text style={styles.actionText}>Report</Text>
            </Pressable>
          </View>
        </View>
      </React.Fragment>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 20, backgroundColor: '#f0fdf4' },
  title: { fontSize: 18, fontWeight: '700', color: '#166534' },
  subtitle: { fontSize: 13, color: '#166534', marginTop: 6 },
  card: { marginTop: 12, borderRadius: 16, backgroundColor: '#ffffff', padding: 14, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#14532d' },
  meta: { fontSize: 12, color: '#15803d' },
  cardBody: { fontSize: 13, lineHeight: 20, color: '#334155' },
  replyBox: { marginTop: 8, borderRadius: 12, backgroundColor: '#dcfce7', padding: 10, gap: 4 },
  replyLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#166534' },
  replyBody: { fontSize: 13, lineHeight: 19, color: '#166534' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionPill: { borderRadius: 999, borderWidth: 1, borderColor: '#86efac', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ffffff' },
  actionText: { fontSize: 12, fontWeight: '600', color: '#166534' },
});
