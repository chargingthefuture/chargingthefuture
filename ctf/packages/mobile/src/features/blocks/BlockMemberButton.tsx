// Reusable "Block member" action (mobile) — Android parity for issue #809, mirrors the web's
// components/blocks/block-member-button.tsx.
//
// Any surface that shows another member can drop this in: it owns the confirm dialog, the POST, and
// the loading / error / done states. The dialog states plainly what a block does, in trauma-informed
// language — the blocked person is never told. It carries the same optional safety escalation as the
// web (a clearly-secondary opt-in that also files an admin safety report); an ordinary block reaches
// no one. The control does not itself hide anyone — it only records the block, then calls onBlocked
// so the surface can refresh.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ban, X } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { blockMember } from './api';

// Matches the web's SAFETY_REPORT_DETAIL_MAX_LENGTH (lib/safety/constants). Kept as a local const so
// the mobile bundle does not reach into the web package; the server is still the real enforcer.
const SAFETY_REPORT_DETAIL_MAX_LENGTH = 2000;

type Status = 'idle' | 'confirming' | 'submitting' | 'done' | 'error';

type BlockMemberButtonProps = {
  // The user id of the member to block.
  targetUserId: string;
  // Optional human label for that member, used in the confirm copy ("Block Jane Doe?"). Falls back
  // to a neutral "this member" when absent.
  displayName?: string | null;
  // Called after a block is created, so a surface can refresh or hide the blocked member.
  onBlocked?: () => void;
};

export function BlockMemberButton({ targetUserId, displayName, onBlocked }: BlockMemberButtonProps) {
  const { tokens } = useTheme();
  const s = makeStyles(tokens);

  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The optional safety escalation, default off. An ordinary block leaves these untouched and reaches
  // no one; only when the switch is on does a report go to the admins.
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [safetyDetail, setSafetyDetail] = useState('');
  // Set true once the just-created block also raised a safety report, so the done state can confirm
  // the report reached the admins.
  const [reported, setReported] = useState(false);

  const label = displayName?.trim() ? displayName.trim() : 'this member';

  const resetForm = useCallback(() => {
    setSafetyConcern(false);
    setSafetyDetail('');
    setErrorMessage(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    setStatus('submitting');
    setErrorMessage(null);
    try {
      const result = await blockMember(targetUserId, safetyConcern ? { concern: true, detail: safetyDetail } : undefined);
      setReported(result.safetyReported);
      setStatus('done');
      onBlocked?.();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to block this member. Please try again.');
    }
  }, [targetUserId, safetyConcern, safetyDetail, onBlocked]);

  const closeDialog = useCallback(() => {
    if (status !== 'submitting') setStatus('idle');
  }, [status]);

  // Once blocked, the trigger becomes a calm, non-actionable confirmation rather than disappearing,
  // so the member gets clear feedback that the block took effect. When a safety report also went out,
  // the label says so, so the member knows the admins were notified.
  if (status === 'done') {
    return (
      <View style={s.doneChip} accessibilityRole="text">
        <Text style={s.doneChipText}>🛡 {reported ? 'Blocked and reported' : 'Blocked'}</Text>
      </View>
    );
  }

  const dialogOpen = status === 'confirming' || status === 'submitting' || status === 'error';

  return (
    <>
      <TouchableOpacity
        onPress={() => { setStatus('confirming'); resetForm(); }}
        style={s.triggerBtn}
        accessibilityRole="button"
        accessibilityLabel={`Block ${label}`}
      >
        <Text style={s.triggerText}>🚫 Block member</Text>
      </TouchableOpacity>

      <BlockConfirmDialog
        s={s}
        tokens={tokens}
        open={dialogOpen}
        status={status}
        label={label}
        safetyConcern={safetyConcern}
        onSafetyConcernChange={setSafetyConcern}
        safetyDetail={safetyDetail}
        onSafetyDetailChange={setSafetyDetail}
        errorMessage={errorMessage}
        onConfirm={handleConfirm}
        onClose={closeDialog}
      />
    </>
  );
}

type Styles = ReturnType<typeof makeStyles>;

type BlockConfirmDialogProps = {
  s: Styles;
  tokens: ThemeTokens;
  open: boolean;
  status: Status;
  label: string;
  safetyConcern: boolean;
  onSafetyConcernChange: (_next: boolean) => void;
  safetyDetail: string;
  onSafetyDetailChange: (_next: string) => void;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

// The confirm sheet: header, trauma-informed body copy, the optional safety escalation, the error
// box, and the two action buttons. Split out of BlockMemberButton so each stays within the
// complexity budget; the rendered output is unchanged.
function BlockConfirmDialog({
  s,
  tokens,
  open,
  status,
  label,
  safetyConcern,
  onSafetyConcernChange,
  safetyDetail,
  onSafetyDetailChange,
  errorMessage,
  onConfirm,
  onClose,
}: BlockConfirmDialogProps) {
  const submitting = status === 'submitting';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.dialog}>
          <View style={s.dialogHeader}>
            <View style={s.dialogHeaderIcon}>
              <Ban size={18} color={tokens.danger} strokeWidth={2} />
            </View>
            <Text style={s.dialogTitle} numberOfLines={2}>Block {label}?</Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={s.dialogClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <X size={14} color={tokens.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={s.dialogBody}>
            <Text style={s.bodyText}>
              They won&apos;t be able to see or contact you, and they won&apos;t be told. This is
              private — no one is notified. You can unblock them later from your blocked members list.
            </Text>

            {/* Optional, clearly-secondary safety escalation. An ordinary block reaches no one; only
                turning this on sends a report to the admins so they can act. */}
            <View style={s.safetyCard}>
              <View style={s.safetyRow}>
                <View style={s.safetyCopy}>
                  <Text style={s.safetyTitle}>⚠️ Report this person to the admins as a safety concern</Text>
                  <Text style={s.safetyHelp}>
                    Only turn this on if you believe they are a suspected predator or human trafficker.
                    An ordinary block does not notify anyone — this sends a private report to the admins
                    so they can review and act.
                  </Text>
                </View>
                <Switch
                  value={safetyConcern}
                  disabled={submitting}
                  onValueChange={onSafetyConcernChange}
                  accessibilityLabel="Report this person to the admins as a safety concern"
                />
              </View>

              {safetyConcern ? (
                <View style={s.detailWrap}>
                  <Text style={s.detailLabel}>Anything the admins should know (optional)</Text>
                  <TextInput
                    value={safetyDetail}
                    editable={!submitting}
                    onChangeText={onSafetyDetailChange}
                    maxLength={SAFETY_REPORT_DETAIL_MAX_LENGTH}
                    multiline
                    placeholder="A short note that would help the admins (optional)"
                    placeholderTextColor={tokens.textMuted}
                    style={s.detailInput}
                  />
                </View>
              ) : null}
            </View>

            {status === 'error' && errorMessage ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={onConfirm}
              disabled={submitting}
              style={s.confirmBtn}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={tokens.danger} size="small" />
              ) : (
                <Text style={s.confirmText}>🚫 {safetyConcern ? 'Block and report' : 'Block member'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={s.cancelBtn}
              accessibilityRole="button"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// makeStyles is split into three grouped helpers so no single function exceeds the complexity
// budget imposed by the many `t.isComic` branches. The merged result is identical to one
// StyleSheet.create call over all keys.
function makeStyles(t: ThemeTokens) {
  return { ...makeStylesTrigger(t), ...makeStylesHeader(t), ...makeStylesBody(t) };
}

function makeStylesTrigger(t: ThemeTokens) {
  const danger = t.danger;
  const r = t.radius;
  return StyleSheet.create({
    triggerBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 9, paddingHorizontal: 14, borderRadius: r,
      backgroundColor: t.isComic ? t.surface : 'rgba(239,68,68,0.06)',
      borderWidth: t.isComic ? 1.5 : 1, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.25)',
    },
    triggerText: { color: danger, fontSize: 13, fontWeight: '700', fontFamily: interFamily('700') },
    doneChip: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 9, paddingHorizontal: 14, borderRadius: r,
      backgroundColor: t.surface, borderWidth: 1, borderColor: t.border,
    },
    doneChipText: { color: t.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: interFamily('600') },
    backdrop: { flex: 1, backgroundColor: 'rgba(9,11,15,0.78)', alignItems: 'center', justifyContent: 'center', padding: 16 },
    dialog: {
      width: '100%', maxWidth: 460, borderRadius: t.isComic ? 0 : 22,
      backgroundColor: t.isComic ? t.surface : '#0D0F14',
      borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.3)',
      overflow: 'hidden',
    },
  });
}

function makeStylesHeader(t: ThemeTokens) {
  const danger = t.danger;
  const r = t.radius;
  const rChip = t.radiusChip;
  return StyleSheet.create({
    dialogHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18,
      borderBottomWidth: t.isComic ? 2 : 1, borderBottomColor: t.isComic ? danger : 'rgba(239,68,68,0.12)',
    },
    dialogHeaderIcon: {
      width: 40, height: 40, borderRadius: rChip,
      backgroundColor: t.isComic ? `${danger}18` : 'rgba(239,68,68,0.12)',
      borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.25)',
      alignItems: 'center', justifyContent: 'center',
    },
    dialogHeaderIconText: { fontSize: 18, fontFamily: interFamily('400') },
    dialogTitle: { flex: 1, fontSize: 17, fontWeight: '800', fontFamily: interFamily('800'), color: t.textPrimary },
    dialogClose: {
      width: 30, height: 30, borderRadius: rChip, backgroundColor: t.isComic ? t.bg : 'rgba(255,255,255,0.04)',
      borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center',
    },
    dialogCloseText: { color: t.textSecondary, fontSize: 14, fontFamily: interFamily('400') },
    dialogBody: { padding: 18 },
    bodyText: { fontSize: 14, color: t.textSecondary, lineHeight: 21, marginBottom: 16, fontFamily: interFamily('400') },
    safetyCard: {
      borderRadius: r, backgroundColor: t.isComic ? `${t.gold}10` : 'rgba(245,158,11,0.05)',
      borderWidth: t.isComic ? 1.5 : 1, borderColor: t.isComic ? t.gold : 'rgba(245,158,11,0.22)',
      padding: 14, marginBottom: 16,
    },
  });
}

function makeStylesBody(t: ThemeTokens) {
  const danger = t.danger;
  const r = t.radius;
  return StyleSheet.create({
    safetyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    safetyCopy: { flex: 1 },
    safetyTitle: { fontSize: 13, fontWeight: '700', fontFamily: interFamily('700'), color: t.isComic ? t.gold : '#F59E0B', marginBottom: 4 },
    safetyHelp: { fontSize: 12.5, color: t.textSecondary, lineHeight: 18, fontFamily: interFamily('400') },
    detailWrap: { marginTop: 12 },
    detailLabel: { fontSize: 12.5, color: t.textSecondary, marginBottom: 6, fontFamily: interFamily('400') },
    detailInput: {
      minHeight: 64, padding: 10, borderRadius: r, textAlignVertical: 'top',
      backgroundColor: t.isComic ? t.bg : 'rgba(255,255,255,0.03)',
      borderWidth: 1, borderColor: t.border, color: t.textPrimary, fontSize: 13, lineHeight: 19, fontFamily: interFamily('400'),
    },
    errorBox: {
      padding: 11, borderRadius: r, marginBottom: 14,
      backgroundColor: t.isComic ? `${danger}12` : 'rgba(239,68,68,0.08)',
      borderWidth: 1, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.3)',
    },
    errorText: { color: t.isComic ? danger : '#F87171', fontSize: 13, lineHeight: 18, fontFamily: interFamily('400') },
    confirmBtn: {
      paddingVertical: 13, borderRadius: r, alignItems: 'center', marginBottom: 10,
      backgroundColor: t.isComic ? `${danger}14` : 'rgba(239,68,68,0.14)',
      borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? danger : 'rgba(239,68,68,0.45)',
    },
    confirmText: { color: danger, fontSize: 14, fontWeight: '700', fontFamily: interFamily('700') },
    cancelBtn: {
      paddingVertical: 13, borderRadius: r, alignItems: 'center',
      backgroundColor: t.isComic ? t.bg : 'rgba(255,255,255,0.04)',
      borderWidth: 1, borderColor: t.border,
    },
    cancelText: { color: t.textSecondary, fontSize: 14, fontWeight: '600', fontFamily: interFamily('600') },
  });
}
