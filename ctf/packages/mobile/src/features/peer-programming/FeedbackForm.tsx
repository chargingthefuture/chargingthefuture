// The "Session Feedback" box, copied from the web's FeedbackForm (web components/peer-programming/
// pp-cohorts-tab.tsx). It shows only once the member's own cohort has ended.
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { interFamily } from '../../components/ui';
import { failureOf, sendFeedback } from './PeerProgrammingApi';
import { usePPTheme } from './usePPTheme';

export function FeedbackForm({ cohortId }: { cohortId: string | null }) {
  const t = usePPTheme();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = submitting || !value.trim();

  const submit = async () => {
    setSuccess(false);
    setError(null);
    if (!value.trim()) {
      setError('Feedback cannot be empty.');
      return;
    }
    setSubmitting(true);
    const failure = failureOf(await sendFeedback(cohortId, value));
    setSubmitting(false);
    if (failure) {
      setError(failure);
      return;
    }
    setSuccess(true);
    setValue('');
  };

  return (
    <View style={[styles.card, { borderRadius: t.r(16), borderColor: t.BORDER, backgroundColor: t.CARD_BG }]}>
      <Text style={[styles.title, { color: t.TEXT }]}>Session Feedback</Text>
      <Text style={[styles.lead, { color: t.SUBTLE }]}>Your cohort has ended. Tell us how it went.</Text>
      <View style={styles.form}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="How was your PeerProgramming experience?"
          placeholderTextColor={t.MUTED}
          accessibilityLabel="How was your PeerProgramming experience?"
          editable={!submitting}
          multiline
          numberOfLines={3}
          style={[styles.input, { backgroundColor: t.INPUT_BG, borderColor: t.BORDER_STRONG, borderRadius: t.r(10), color: t.TEXT }]}
        />
        <View style={styles.row}>
          <TouchableOpacity
            onPress={() => void submit()}
            disabled={disabled}
            accessibilityRole="button"
            style={[styles.button, { borderRadius: t.r(8), backgroundColor: t.ACCENT, opacity: disabled ? 0.6 : 1 }]}
          >
            <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Submit Feedback'}</Text>
          </TouchableOpacity>
          {success ? <Text style={[styles.status, { color: '#22C55E' }]}>Thank you for your feedback!</Text> : null}
          {error ? <Text style={[styles.status, { color: '#EF4444' }]}>{error}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 20, paddingHorizontal: 24, borderWidth: 1 },
  title: { fontSize: 15, fontFamily: interFamily('700'), marginBottom: 4 },
  lead: { fontSize: 13, fontFamily: interFamily('400'), marginBottom: 12 },
  form: { gap: 10 },
  input: {
    minHeight: 76,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: interFamily('400'),
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  button: { paddingVertical: 9, paddingHorizontal: 20 },
  buttonText: { color: '#fff', fontSize: 13, fontFamily: interFamily('700') },
  status: { fontSize: 13, fontFamily: interFamily('400') },
});
