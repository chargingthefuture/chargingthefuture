// Full-account deletion confirmation, copied from the web's AccountDataConfirmDelete
// (components/account-data/account-data-confirm-delete.tsx): a panel over a dimmed screen that
// asks the member to type the exact phrase before Delete permanently turns on, then the
// "Deletion queued" acknowledgement.

import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CheckCircle, Lock, Trash2, X, type LucideIcon } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { getAccountTokens, radius, Spinner, type AccountTokens } from '../account';
import { FULL_ACCOUNT_CONFIRM_PHRASE } from './glyphs';

type ConfirmStatus = 'idle' | 'submitting' | 'done' | 'error';

export function ConfirmDelete({
  serviceCount,
  onCancel,
  onConfirm,
}: {
  serviceCount: number;
  onCancel: () => void;
  /** Runs DELETE /api/account/full-account. Resolves on success, rejects with a member-facing message. */
  onConfirm: () => Promise<void>;
}) {
  const { tokens } = useTheme();
  const tok = getAccountTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ConfirmStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submitting = status === 'submitting';
  const ready = input.toLowerCase().trim() === FULL_ACCOUNT_CONFIRM_PHRASE && !submitting;

  async function handleConfirm() {
    if (!ready) return;
    setStatus('submitting');
    setErrorMessage(null);
    try {
      await onConfirm();
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete deletion. Please try again.');
    }
  }

  if (status === 'done') return <DeletionQueued s={s} />;

  const points: Array<{ t: string; Icon: LucideIcon; c: string }> = [
    { t: `All personal data deleted across ${serviceCount} services`, Icon: Trash2, c: '#EF4444' },
    { t: 'ServiceCredits: held 7 days, then returned to the community treasury (an active escrow resolves first)', Icon: CheckCircle, c: '#9CA3AF' },
    { t: 'Some audit records retained for platform integrity — this is intentional', Icon: Lock, c: '#9CA3AF' },
    { t: 'Your profile and username removed from all directories', Icon: Trash2, c: '#EF4444' },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => { if (!submitting) onCancel(); }}>
      <ScrollView style={s.overlay} contentContainerStyle={s.overlayContent}>
        <View style={s.panel}>
          <View style={s.band}>
            <BandGradient />
            <View style={s.bandIcon}>
              <Trash2 size={21} color="#EF4444" />
            </View>
            <View style={s.flex}>
              <Text style={s.bandTitle}>Delete your entire account</Text>
              <Text style={s.bandSub}>Permanent — this cannot be reversed.</Text>
            </View>
            <TouchableOpacity
              onPress={() => { if (!submitting) onCancel(); }}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={s.close}
            >
              <X size={14} color={tok.SUBTLE} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            <Text style={s.label}>What will happen</Text>
            <View style={s.points}>
              {points.map(({ t, Icon, c }) => (
                <View key={t} style={s.point}>
                  <Icon size={14} color={c} style={s.pointIcon} />
                  <Text style={s.pointText}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>
                To confirm, type <Text style={s.phrase}>{FULL_ACCOUNT_CONFIRM_PHRASE}</Text> in the field below.
              </Text>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={FULL_ACCOUNT_CONFIRM_PHRASE}
                placeholderTextColor={tok.SUBTLE}
                autoCapitalize="none"
                autoCorrect={false}
                style={[s.input, ready ? s.inputReady : null]}
              />
            </View>

            {status === 'error' && errorMessage ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={s.actions}>
              <DeleteButton s={s} ready={ready} submitting={submitting} onPress={() => void handleConfirm()} />
              <TouchableOpacity onPress={onCancel} disabled={submitting} accessibilityRole="button" style={s.keepBtn}>
                <Text style={s.keepText}>Keep my data</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}

// The header band's linear-gradient(135deg, rgba(239,68,68,0.1), rgba(233,30,140,0.04)).
function BandGradient() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="confirmBand" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#EF4444" stopOpacity={0.1} />
          <Stop offset="1" stopColor="#E91E8C" stopOpacity={0.04} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#confirmBand)" />
    </Svg>
  );
}



// Delete permanently: dark until the phrase is typed, then red; a spinner while it runs.
function DeleteButton({ s, ready, submitting, onPress }: { s: ReturnType<typeof makeStyles>; ready: boolean; submitting: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!ready}
      accessibilityRole="button"
      style={[s.deleteBtn, ready ? s.deleteBtnReady : null]}
    >
      {submitting ? <Spinner size={15} color="#374151" /> : <Trash2 size={15} color={ready ? '#EF4444' : '#374151'} />}
      <Text style={[s.deleteText, ready ? s.deleteTextReady : null]}>
        {submitting ? 'Deleting…' : 'Delete permanently'}
      </Text>
    </TouchableOpacity>
  );
}

// The "Deletion queued" acknowledgement shown once the delete request is accepted.
function DeletionQueued({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <Modal visible animationType="none" onRequestClose={() => undefined}>
      <View style={s.doneRoot}>
        <View style={s.doneIcon}>
          <CheckCircle size={30} color="#22C55E" />
        </View>
        <Text style={s.doneTitle}>Deletion queued</Text>
        <Text style={s.doneBody}>
          Your request has been received. Your personal data is being removed across all services, and your sign-in is removed with it — you will not be able to sign back in. Your ServiceCredits are held for 7 days from now, then returned to the community treasury; if any are locked in an active escrow, the return waits until that escrow resolves. Some audit records are retained for platform integrity.
        </Text>
      </View>
    </Modal>
  );
}

function makeStyles(t: ThemeTokens, tok: AccountTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    doneRoot: { flex: 1, backgroundColor: tok.BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    doneIcon: { width: 64, height: 64, borderRadius: radius(t, 32), backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    doneTitle: { fontSize: 22, fontFamily: interFamily('800'), color: tok.TEXT, marginBottom: 10, textAlign: 'center' },
    doneBody: { fontSize: 14, lineHeight: 23.8, fontFamily: interFamily('400'), color: tok.SUBTLE, textAlign: 'center' },
    overlay: { flex: 1, backgroundColor: 'rgba(9,11,15,0.78)' },
    overlayContent: { padding: 16 },
    panel: { width: '100%', maxWidth: 560, alignSelf: 'center', borderRadius: radius(t, 22), backgroundColor: '#0D0F14', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', overflow: 'hidden', elevation: 12 },
    band: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 24, paddingHorizontal: 26, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.12)' },
    bandIcon: { width: 46, height: 46, borderRadius: radius(t, 13), backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', alignItems: 'center', justifyContent: 'center' },
    bandTitle: { fontSize: 18, fontFamily: interFamily('800'), color: tok.TEXT },
    bandSub: { fontSize: 13, fontFamily: interFamily('400'), color: '#EF4444', marginTop: 2 },
    close: { width: 30, height: 30, borderRadius: radius(t, 8), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: tok.BORDER, alignItems: 'center', justifyContent: 'center' },
    body: { paddingVertical: 22, paddingHorizontal: 26 },
    label: { fontSize: 12, fontFamily: interFamily('700'), color: tok.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.84, marginBottom: 12 },
    points: { gap: 10, marginBottom: 22 },
    point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    pointIcon: { marginTop: 2 },
    pointText: { flex: 1, fontSize: 13, lineHeight: 20.15, fontFamily: interFamily('400'), color: '#9CA3AF' },
    field: { padding: 16, borderRadius: radius(t, 12), backgroundColor: 'rgba(239,68,68,0.04)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.14)', marginBottom: 18 },
    fieldLabel: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400'), color: '#9CA3AF', marginBottom: 10 },
    phrase: { color: '#EF4444', fontFamily: 'monospace', fontWeight: '700' },
    input: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: tok.BG, borderWidth: 1, borderColor: tok.BORDER, borderRadius: radius(t, 8), fontSize: 14, color: tok.TEXT, fontFamily: 'monospace' },
    inputReady: { borderColor: 'rgba(239,68,68,0.5)', color: '#EF4444' },
    errorBox: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius(t, 8), backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginBottom: 16 },
    errorText: { color: '#F87171', fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
    actions: { flexDirection: 'row', gap: 10 },
    deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, borderRadius: radius(t, 11), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: tok.BORDER },
    deleteBtnReady: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.45)' },
    deleteText: { fontSize: 14, fontFamily: interFamily('700'), color: '#374151' },
    deleteTextReady: { color: '#EF4444' },
    keepBtn: { paddingVertical: 13, paddingHorizontal: 22, borderRadius: radius(t, 11), backgroundColor: `${tok.BRAND}12`, borderWidth: 1, borderColor: `${tok.BRAND}30`, justifyContent: 'center' },
    keepText: { fontSize: 14, fontFamily: interFamily('600'), color: tok.BRAND },
  });
}
