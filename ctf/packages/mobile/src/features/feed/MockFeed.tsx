import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mobileFeedItems } from '../../mocks/feedDemoData';

type Filter = 'all' | 'announcement' | 'question' | 'community';

export const MockFeed = () => {
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => {
    if (filter === 'all') {
      return mobileFeedItems;
    }

    return mobileFeedItems.filter((item) => item.channel === filter);
  }, [filter]);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Unified Feed</Text>
      <Text style={styles.title}>Announcements, questions, and community</Text>
      <Text style={styles.subtitle}>Mobile parity shell for the three-channel survivor timeline.</Text>

      <View style={styles.pills}>
        {(['all', 'announcement', 'question', 'community'] as Filter[]).map((value) => (
          <Pressable onPress={() => setFilter(value)} style={[styles.pill, filter === value ? styles.pillActive : null]}>
            <Text style={[styles.pillText, filter === value ? styles.pillTextActive : null]}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <React.Fragment>
            <View style={styles.card}>
              <Text style={styles.cardType}>{item.channel}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              {item.answers?.[0] ? (
                <View style={styles.inlineBox}>
                  <Text style={styles.inlineLabel}>Assisted answer</Text>
                  <Text style={styles.inlineBody}>{item.answers[0].body}</Text>
                </View>
              ) : null}
              {item.replies?.length ? (
                <View style={styles.inlineBox}>
                  <Text style={styles.inlineLabel}>Replies</Text>
                  {item.replies.map((reply) => (
                    <React.Fragment>
                      <Text style={styles.inlineBody}>{reply.body}</Text>
                    </React.Fragment>
                  ))}
                </View>
              ) : null}
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 20, backgroundColor: '#eef6ff' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#0369a1' },
  title: { fontSize: 20, fontWeight: '700', marginTop: 6, color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#334155', marginTop: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pill: { borderWidth: 1, borderColor: '#bae6fd', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  pillText: { color: '#0f172a', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  pillTextActive: { color: '#fff' },
  list: { gap: 10, marginTop: 14 },
  card: { borderRadius: 16, backgroundColor: '#fff', padding: 14, gap: 6 },
  cardType: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#0369a1' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cardBody: { fontSize: 13, color: '#334155', lineHeight: 20 },
  inlineBox: { marginTop: 8, borderRadius: 12, backgroundColor: '#eff6ff', padding: 10, gap: 4 },
  inlineLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#0369a1' },
  inlineBody: { fontSize: 12, color: '#1e293b', lineHeight: 18 },
});