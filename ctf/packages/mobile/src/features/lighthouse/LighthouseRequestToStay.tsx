import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import { createMatchRequest } from './api';

// The seeker-facing action on a listing: request to stay. Mirrors the web
// RequestToStay in ctf/packages/web/components/lighthouse/lighthouse-property-detail.tsx. Creates a
// match request via POST /api/lighthouse/matches, which opens a private chat channel between the
// seeker and host on acceptance. A member with no active seeker profile is sent to set one up first
// (the endpoint denies with `policy_denied` until they do).

interface Props {
  propertyId: string;
  // Called when the member has no active seeker profile yet, so the parent can switch to the
  // "Your details" tab.
  onNeedsProfile?: () => void;
}

export const LighthouseRequestToStay: React.FC<Props> = ({ propertyId, onNeedsProfile }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [outcome, setOutcome] = useState<'sent' | 'duplicate' | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setNeedsProfile(false);
    const result = await createMatchRequest({
      propertyId,
      message: message.trim() || null,
      desiredMoveInDateIso: moveInDate.trim() || null,
    });
    setSubmitting(false);
    if (result.ok) {
      setOutcome('sent');
      setOpen(false);
      return;
    }
    if (result.code === 'policy_denied' || result.code === 'profile_not_found') {
      setNeedsProfile(true);
      return;
    }
    if (result.code === 'duplicate_match') {
      setOutcome('duplicate');
      setOpen(false);
      return;
    }
    setError(result.message ?? 'Could not send your request. Please try again.');
  };

  if (outcome) {
    return (
      <View style={styles.card}>
        <View style={styles.sentRow}>
          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          <Text style={styles.sentText}>
            {outcome === 'sent'
              ? 'Request sent. The host will see it in their matches.'
              : 'You already have an active request for this listing.'}
          </Text>
        </View>
        <Text style={styles.hint}>Track it in the Matches tab.</Text>
      </View>
    );
  }

  if (needsProfile) {
    return (
      <View style={styles.card}>
        <Text style={styles.needsText}>
          Set up your housing details before you request a stay — a host needs to know what you’re
          looking for.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => onNeedsProfile?.()} activeOpacity={0.85}>
          <Ionicons name="person-add-outline" size={15} color="#0F1117" />
          <Text style={styles.primaryBtnText}>Set up your details</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!open) {
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setOpen(true)} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Request to stay</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>The host sees your details only after you request. Nothing is charged.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Message to the host (optional)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={message}
        onChangeText={setMessage}
        placeholder="Introduce yourself and why this place fits."
        placeholderTextColor={tokens.textMuted}
        multiline
        autoCapitalize="sentences"
      />
      <Text style={styles.label}>Preferred move-in date (optional)</Text>
      <TextInput
        style={styles.input}
        value={moveInDate}
        onChangeText={setMoveInDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.primaryBtn, styles.primaryBtnSpaced, submitting && styles.btnDisabled]}
        onPress={() => void submit()}
        disabled={submitting}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>{submitting ? 'Sending…' : 'Send request'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryBtn, submitting && styles.btnDisabled]}
        onPress={() => { setOpen(false); setError(null); }}
        disabled={submitting}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: `${accent}08`,
      borderWidth: 1,
      borderColor: `${accent}20`,
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      color: t.textSecondary,
      fontWeight: '600',
      marginBottom: 4,
    },
    input: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 8,
      paddingVertical: 9,
      paddingHorizontal: 10,
      fontSize: 13,
      color: t.textPrimary,
      marginBottom: 10,
    },
    textarea: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: accent,
      borderRadius: 10,
      paddingVertical: 12,
    },
    primaryBtnSpaced: {
      marginTop: 2,
      marginBottom: 8,
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#0F1117',
    },
    secondaryBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    secondaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    hint: {
      fontSize: 12,
      color: t.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 10,
    },
    needsText: {
      fontSize: 13,
      color: t.textSecondary,
      lineHeight: 19,
      marginBottom: 12,
    },
    sentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sentText: {
      color: '#22C55E',
      fontSize: 13,
      flexShrink: 1,
      lineHeight: 18,
    },
    errorText: {
      color: t.danger,
      fontSize: 13,
      marginBottom: 8,
    },
  });
}
