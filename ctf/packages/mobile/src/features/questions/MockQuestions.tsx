import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mobileFeedItems } from '../../mocks/feedDemoData';

const questions = mobileFeedItems.filter((item) => item.channel === 'question');

export const MockQuestions = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Questions Channel</Text>
    <Text style={styles.subtitle}>Mobile parity shell for question submission, assisted answers, and ratings.</Text>
    {questions.map((item) => {
      const answer = item.answers?.[0];
      return (
        <React.Fragment>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.category ?? 'general'} {item.location ? `· ${item.location}` : ''}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            {answer ? (
              <View style={styles.answerBox}>
                <Text style={styles.answerLabel}>LLM-assisted answer</Text>
                <Text style={styles.answerBody}>{answer.body}</Text>
                <Text style={styles.answerMeta}>Confidence {(answer.confidence * 100).toFixed(0)}%</Text>
                <View style={styles.ratingRow}>
                  <Pressable style={styles.ratingPill}>
                    <Text style={styles.ratingText}>Helpful</Text>
                  </Pressable>
                  <Pressable style={styles.ratingPill}>
                    <Text style={styles.ratingText}>Not Helpful</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </React.Fragment>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 20, backgroundColor: '#eff6ff' },
  title: { fontSize: 18, fontWeight: '700', color: '#1d4ed8' },
  subtitle: { fontSize: 13, color: '#1e3a8a', marginTop: 6 },
  card: { marginTop: 12, borderRadius: 16, backgroundColor: '#ffffff', padding: 14, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 12, color: '#1d4ed8' },
  cardBody: { fontSize: 13, lineHeight: 20, color: '#334155' },
  answerBox: { marginTop: 8, borderRadius: 12, backgroundColor: '#dbeafe', padding: 10, gap: 4 },
  answerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#1d4ed8' },
  answerBody: { fontSize: 13, lineHeight: 19, color: '#1e3a8a' },
  answerMeta: { fontSize: 11, color: '#1d4ed8' },
  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  ratingPill: { borderRadius: 999, borderWidth: 1, borderColor: '#93c5fd', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ffffff' },
  ratingText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
});