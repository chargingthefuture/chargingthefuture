

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import {
  fetchRoom, postMessage, submitFeedback,
  type PeerProgrammingCohort, type PeerProgrammingMessage, type PeerProgrammingTopic,
} from './api';

const COLOR = '#8B5CF6';

const NAV = [
  { label: 'Home', key: 'home' },
  { label: 'Session', key: 'session' },
  { label: 'Discussion', key: 'discussion' },
  { label: 'Feedback', key: 'feedback' },
];

export const PeerProgramming = () => {
  const [activeNav, setActiveNav] = useState<string>('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<PeerProgrammingTopic | null>(null);
  const [cohort, setCohort] = useState<PeerProgrammingCohort | null>(null);
  const [messages, setMessages] = useState<PeerProgrammingMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRoom = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchRoom();
      setTopic(data.topic);
      setCohort(data.cohort);
      setMessages(data.messages);
    } catch (e: any) {
      setError(e.message || 'Failed to load peer programming room.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRoom();
  }, [loadRoom]);

  const handlePostMessage = useCallback(async () => {
    if (!messageInput.trim() || !cohort || submitting) return;
    setSubmitting(true);
    try {
      const msg = await postMessage(cohort.id, messageInput.trim());
      setMessages((prev) => [...prev, msg]);
      setMessageInput('');
    } catch (e: any) {
      setError(e.message || 'Failed to post message.');
    } finally {
      setSubmitting(false);
    }
  }, [messageInput, cohort, submitting]);

  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackInput.trim() || submitting) return;
    setFeedbackError(null);
    setSubmitting(true);
    try {
      await submitFeedback(cohort?.id ?? null, feedbackInput.trim());
      setFeedbackSuccess(true);
      setFeedbackInput('');
    } catch (e: any) {
      setFeedbackError(e.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  }, [feedbackInput, cohort, submitting]);

  if (loading) {
    return <View style={styles.emptyState}><ActivityIndicator color={COLOR} size="large" /></View>;
  }

  if (error && !cohort) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>{error}</Text>
        <TouchableOpacity onPress={loadRoom} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Peer Programming</Text>
        {cohort ? (
          <Text style={styles.headerSubtitle}>{cohort.cohortLabel}</Text>
        ) : (
          <Text style={styles.headerSubtitle}>No cohort assigned this week</Text>
        )}
      </View>

      <View style={styles.navBar}>
        {NAV.map(({ label, key }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveNav(key)}
            style={[styles.navItem, activeNav === key && styles.navItemActive]}
          >
            <Text style={[styles.navLabel, activeNav === key && styles.navLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Home — topic + cohort overview */}
        {activeNav === 'home' && (
          <View>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Deterministic Placement</Text>
              <Text style={styles.infoDesc}>Every survivor gets placed in a cohort. No one left behind.</Text>
            </View>
            {!cohort ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  You're not assigned to a cohort this week.{'\n'}Assignments happen every Monday.
                </Text>
              </View>
            ) : (
              <View style={styles.cohortCard}>
                <Text style={styles.cohortName}>{cohort.cohortLabel}</Text>
                <Text style={styles.cohortMeta}>Week of {cohort.weekStartDate}</Text>
                {cohort.fallbackOpen && (
                  <Text style={styles.openBadge}>Open session</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Session — weekly topic */}
        {activeNav === 'session' && (
          <View>
            {!topic ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No topic published for this week yet.</Text>
              </View>
            ) : (
              <View style={styles.topicCard}>
                <Text style={styles.topicWeek}>Week of {topic.weekStartDate}</Text>
                <Text style={styles.topicTitle}>{topic.title}</Text>
                <Text style={styles.topicGuidance}>{topic.guidance}</Text>
              </View>
            )}
          </View>
        )}

        {/* Discussion — messages */}
        {activeNav === 'discussion' && (
          <View>
            {!cohort ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Join a cohort to participate in discussion.</Text>
              </View>
            ) : (
              <>
                {messages.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
                  </View>
                ) : (
                  messages.map((msg) => (
                    <View key={msg.id} style={styles.messageCard}>
                      <Text style={styles.messageTime}>
                        {new Date(msg.createdAtIso).toLocaleString()}
                      </Text>
                      <Text style={styles.messageBody}>{msg.body}</Text>
                    </View>
                  ))
                )}
                {error && <Text style={styles.errorText}>{error}</Text>}
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={messageInput}
                    onChangeText={setMessageInput}
                    placeholder="Type your message…"
                    placeholderTextColor="#4B5563"
                    editable={!submitting}
                    multiline={false}
                    returnKeyType="send"
                    onSubmitEditing={handlePostMessage}
                  />
                  <TouchableOpacity
                    onPress={handlePostMessage}
                    disabled={submitting || !messageInput.trim()}
                    style={[styles.sendBtn, (submitting || !messageInput.trim()) && styles.sendBtnDisabled]}
                  >
                    <Text style={styles.sendBtnText}>{submitting ? '…' : 'Send'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Feedback */}
        {activeNav === 'feedback' && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackTitle}>Session Feedback</Text>
            <Text style={styles.feedbackDesc}>
              How was your peer programming experience this week?
            </Text>
            {feedbackSuccess ? (
              <View style={styles.emptyState}>
                <Text style={{ color: '#22C55E', fontSize: 16, fontWeight: '700' }}>
                  Thank you for your feedback! 💚
                </Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.textInput, styles.feedbackInput]}
                  value={feedbackInput}
                  onChangeText={setFeedbackInput}
                  placeholder="Share your thoughts…"
                  placeholderTextColor="#4B5563"
                  editable={!submitting}
                  multiline
                  numberOfLines={4}
                />
                {feedbackError && <Text style={styles.errorText}>{feedbackError}</Text>}
                <TouchableOpacity
                  onPress={handleSubmitFeedback}
                  disabled={submitting || !feedbackInput.trim()}
                  style={[styles.submitBtn, (submitting || !feedbackInput.trim()) && styles.sendBtnDisabled]}
                >
                  <Text style={styles.submitBtnText}>
                    {submitting ? 'Submitting…' : 'Submit Feedback'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117', paddingTop: 32 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F9FAFB' },
  headerSubtitle: { fontSize: 12, color: COLOR, fontWeight: '600', marginTop: 2 },
  navBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#090B0F', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  navItem: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  navItemActive: { backgroundColor: `${COLOR}20` },
  navLabel: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  navLabelActive: { color: COLOR },
  content: { flex: 1, padding: 16 },
  infoBox: { backgroundColor: `${COLOR}08`, borderColor: `${COLOR}18`, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: COLOR, marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#6B7280' },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyText: { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: `${COLOR}15`, borderWidth: 1, borderColor: `${COLOR}30` },
  retryText: { color: COLOR, fontSize: 14, fontWeight: '600' },
  // Cohort card (Home tab)
  cohortCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: `${COLOR}30`, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 },
  cohortName: { fontSize: 15, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  cohortMeta: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  openBadge: { fontSize: 11, color: '#22C55E', backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  // Topic card (Session tab)
  topicCard: { backgroundColor: `${COLOR}08`, borderColor: `${COLOR}20`, borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 10 },
  topicWeek: { fontSize: 11, color: COLOR, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  topicTitle: { fontSize: 18, fontWeight: '800', color: '#F9FAFB', marginBottom: 10 },
  topicGuidance: { fontSize: 14, color: '#9CA3AF', lineHeight: 22 },
  // Messages (Discussion tab)
  messageCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 12, marginBottom: 8 },
  messageTime: { fontSize: 10, color: '#4B5563', marginBottom: 4 },
  messageBody: { fontSize: 14, color: '#E8EAF0', lineHeight: 20 },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  textInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#E8EAF0' },
  sendBtn: { backgroundColor: COLOR, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Feedback tab
  feedbackContainer: { padding: 4 },
  feedbackTitle: { fontSize: 18, fontWeight: '700', color: '#F9FAFB', marginBottom: 6 },
  feedbackDesc: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  feedbackInput: { flex: 0, height: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
