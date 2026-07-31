// Report-a-problem modal (mobile) — pixel-pass to
// design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/MobileReportAProblem*.tsx
//
// Mirrors the web surface one-to-one: a bottom sheet with five states — form,
// submitting, success, error, rate-limited — wired to POST /api/bug-reports with the
// `x-ctf-csrf: 1` header. Colors come from the active theme tokens (useTheme); the
// mockup's hard-coded purple→cyan gradient and fixed hex values are not used here.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle, AlertCircle, Clock, X, type LucideIcon } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { submitBugReport, type BugReportSubmitResult } from './api';

// The message and context fields share the server's 5000-character cap.
const FIELD_MAX_LENGTH = 5000;

type ViewState = 'form' | 'success' | 'error' | 'rate_limited';

type BugReportModalProps = {
  visible: boolean;
  onClose: () => void;
  // The plugin the member is using, if the host screen can supply it. Optional.
  pluginSlug?: string;
};

export function BugReportModal({ visible, onClose, pluginSlug }: BugReportModalProps) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);

  const [message, setMessage] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<ViewState>('form');
  const [heldForReview, setHeldForReview] = useState(false);

  // Start every open from a clean, empty form.
  useEffect(() => {
    if (visible) {
      setMessage('');
      setContext('');
      setSubmitting(false);
      setView('form');
      setHeldForReview(false);
    }
  }, [visible]);

  const closeIfIdle = useCallback(() => {
    if (submitting) {
      return;
    }
    onClose();
  }, [submitting, onClose]);

  const runSubmit = useCallback(async () => {
    if (message.trim().length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    let result: BugReportSubmitResult;
    try {
      result = await submitBugReport({ message: message.trim(), context, pluginSlug });
    } finally {
      setSubmitting(false);
    }

    if (result.kind === 'success') {
      setHeldForReview(result.status === 'held_for_review');
      setView('success');
    } else if (result.kind === 'rate_limited') {
      setView('rate_limited');
    } else {
      // Error: keep the typed text exactly as it is so nothing is lost.
      setView('error');
    }
  }, [message, context, submitting, pluginSlug]);

  const resetToForm = useCallback(() => {
    setMessage('');
    setContext('');
    setHeldForReview(false);
    setView('form');
  }, []);

  const canSend = message.trim().length > 0 && !submitting;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeIfIdle}>
      <Pressable style={s.overlay} onPress={closeIfIdle}>
        {/* Stop taps inside the sheet from closing it. */}
        <Pressable style={s.sheet} onPress={() => undefined}>
          <View style={s.handle} />
          <ScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
            {view === 'form' ? (
              <FormBody
                s={s}
                tokens={tokens}
                message={message}
                context={context}
                submitting={submitting}
                canSend={canSend}
                onMessageChange={setMessage}
                onContextChange={setContext}
                onSubmit={() => void runSubmit()}
                onCancel={closeIfIdle}
              />
            ) : null}

            {view === 'success' ? (
              <ResultBody
                s={s}
                Icon={CheckCircle}
                iconColor={tokens.success}
                glyphStyle={s.iconSuccess}
                title="Got it — we'll look into this."
                body={
                  heldForReview
                    ? 'A member of our team will read your report before we act on it. You won’t get a reply, but your report makes a difference.'
                    : 'We’ll read your report and use it to fix problems in the app. You won’t get a reply, but your report makes a difference.'
                }
                primaryLabel="Done"
                onPrimary={onClose}
                linkLabel="Report another problem"
                onLink={resetToForm}
              />
            ) : null}

            {view === 'error' ? (
              <ResultBody
                s={s}
                Icon={AlertCircle}
                iconColor="#EF4444"
                glyphStyle={s.iconError}
                title="Couldn't send your report."
                body="Check your connection and try again. What you wrote is still there — nothing has been lost."
                primaryLabel="Try again"
                onPrimary={() => void runSubmit()}
                linkLabel="Cancel"
                onLink={onClose}
              />
            ) : null}

            {view === 'rate_limited' ? (
              <ResultBody
                s={s}
                Icon={Clock}
                iconColor={tokens.textSecondary}
                glyphStyle={s.iconWait}
                title="We already have your recent reports."
                body="There's no need to send another one right now — try again in a little while."
                neutralLabel="OK"
                onNeutral={onClose}
              />
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type FormBodyProps = {
  s: Styles;
  tokens: ThemeTokens;
  message: string;
  context: string;
  submitting: boolean;
  canSend: boolean;
  onMessageChange: (_next: string) => void;
  onContextChange: (_next: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

function FormBody({
  s,
  tokens,
  message,
  context,
  submitting,
  canSend,
  onMessageChange,
  onContextChange,
  onSubmit,
  onCancel,
}: FormBodyProps) {
  return (
    <>
      <View style={s.headerRow}>
        <Text style={s.title}>Report a problem</Text>
        <TouchableOpacity
          onPress={onCancel}
          disabled={submitting}
          style={s.close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={14} color={tokens.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <Text style={s.subtitle}>
        Use this when something in the app isn&apos;t working. Reports are one-way — you
        won&apos;t get a reply here. Have a question? Ask in the Commons on the home screen,
        where members can answer.
      </Text>

      <View style={s.field}>
        <View style={s.labelRow}>
          <Text style={s.label}>What went wrong?</Text>
          <View style={s.badgeRequired}>
            <Text style={s.badgeRequiredText}>required</Text>
          </View>
        </View>
        <TextInput
          value={message}
          onChangeText={onMessageChange}
          editable={!submitting}
          multiline
          maxLength={FIELD_MAX_LENGTH}
          placeholder="Describe what happened…"
          placeholderTextColor={tokens.textMuted}
          style={[s.input, s.inputTall, submitting && s.inputDisabled]}
        />
      </View>

      <View style={s.field}>
        <View style={s.labelRow}>
          <Text style={s.label}>What were you trying to do?</Text>
          <View style={s.badgeOptional}>
            <Text style={s.badgeOptionalText}>optional</Text>
          </View>
        </View>
        <TextInput
          value={context}
          onChangeText={onContextChange}
          editable={!submitting}
          multiline
          maxLength={FIELD_MAX_LENGTH}
          placeholder="This helps us understand the context…"
          placeholderTextColor={tokens.textMuted}
          style={[s.input, submitting && s.inputDisabled]}
        />
      </View>

      <View style={s.privacyNote}>
        <Text style={s.privacyNoteText}>
          Our team reads these to fix problems. Please don&apos;t include passwords or personal
          details.
        </Text>
      </View>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={!canSend}
        style={[s.primaryBtn, !canSend && s.primaryBtnDisabled]}
        accessibilityRole="button"
      >
        <Text style={s.primaryBtnText}>{submitting ? 'Sending…' : 'Send report'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onCancel}
        disabled={submitting}
        style={s.ghostBtn}
        accessibilityRole="button"
      >
        <Text style={s.ghostBtnText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );
}

type ResultBodyProps = {
  s: Styles;
  Icon: LucideIcon;
  iconColor: string;
  glyphStyle: object;
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  linkLabel?: string;
  onLink?: () => void;
  neutralLabel?: string;
  onNeutral?: () => void;
};

function ResultBody({
  s,
  Icon,
  iconColor,
  glyphStyle,
  title,
  body,
  primaryLabel,
  onPrimary,
  linkLabel,
  onLink,
  neutralLabel,
  onNeutral,
}: ResultBodyProps) {
  return (
    <View style={s.resultWrap}>
      <View style={[s.resultIcon, glyphStyle]}>
        <Icon size={28} color={iconColor} strokeWidth={2} />
      </View>
      <Text style={s.resultTitle}>{title}</Text>
      <Text style={s.resultBody}>{body}</Text>

      {primaryLabel && onPrimary ? (
        <TouchableOpacity onPress={onPrimary} style={s.primaryBtn} accessibilityRole="button">
          <Text style={s.primaryBtnText}>{primaryLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {linkLabel && onLink ? (
        <TouchableOpacity onPress={onLink} style={s.linkBtn} accessibilityRole="button">
          <Text style={s.linkText}>{linkLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {neutralLabel && onNeutral ? (
        <TouchableOpacity onPress={onNeutral} style={s.neutralBtn} accessibilityRole="button">
          <Text style={s.neutralText}>{neutralLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

// makeStyles is split into grouped helpers so no single function exceeds the complexity budget
// imposed by the many `t.isComic` branches. The merged result is identical to one
// StyleSheet.create call over all keys.
function makeStyles(t: ThemeTokens) {
  return {
    ...makeStylesSheet(t),
    ...makeStylesFields(t),
    ...makeStylesButtons(t),
    ...makeStylesResult(t),
  };
}

function makeStylesSheet(t: ThemeTokens) {
  const rChip = t.radiusChip;
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: t.isComic ? 0 : 20,
      borderTopRightRadius: t.isComic ? 0 : 20,
      borderWidth: t.isComic ? 2 : 1,
      borderBottomWidth: 0,
      borderColor: t.border,
      paddingTop: 8,
      maxHeight: '90%',
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.borderDim, alignSelf: 'center', marginBottom: 16 },
    sheetContent: { paddingHorizontal: 20, paddingBottom: 28 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 17, fontWeight: '800', fontFamily: interFamily('800'), color: t.textPrimary, letterSpacing: t.isComic ? 0.5 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    subtitle: { fontSize: 13, color: t.textSecondary, marginTop: 4, marginBottom: 18, fontFamily: interFamily('400') },
    close: { width: 30, height: 30, borderRadius: rChip, backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: t.textSecondary, fontSize: 14, fontFamily: interFamily('400') },
  });
}

function makeStylesFields(t: ThemeTokens) {
  const r = t.radius;
  return StyleSheet.create({
    field: { marginBottom: 14 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
    label: { fontSize: 13, fontWeight: '600', fontFamily: interFamily('600'), color: t.textPrimary },
    badgeRequired: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)' },
    badgeRequiredText: { fontSize: 10, fontWeight: '600', fontFamily: interFamily('600'), color: '#FCA5A5' },
    badgeOptional: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    badgeOptionalText: { fontSize: 10, fontWeight: '600', fontFamily: interFamily('600'), color: t.textSecondary },
    input: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.isComic ? t.bg : 'rgba(255,255,255,0.04)',
      borderWidth: t.isComic ? 1.5 : 1,
      borderColor: t.isComic ? t.border : 'rgba(255,255,255,0.1)',
      borderRadius: r,
      fontSize: 14,
      fontFamily: interFamily('400'),
      color: t.textPrimary,
      minHeight: 56,
      textAlignVertical: 'top',
    },
    inputTall: { minHeight: 80 },
    inputDisabled: { opacity: 0.45 },
    privacyNote: { padding: 12, borderRadius: t.isComic ? 0 : 8, backgroundColor: t.isComic ? `${t.border}08` : 'rgba(255,255,255,0.03)', borderWidth: t.isComic ? 1.5 : 1, borderColor: t.isComic ? `${t.borderDim}40` : 'rgba(255,255,255,0.06)', marginBottom: 18 },
    privacyNoteText: { fontSize: 12, color: t.textSecondary, lineHeight: 18, fontFamily: interFamily('400') },
  });
}

function makeStylesButtons(t: ThemeTokens) {
  const r = t.radius;
  return StyleSheet.create({
    primaryBtn: { paddingVertical: 13, borderRadius: r, backgroundColor: t.isComic ? `${t.gold}1A` : '#7C3AED', borderWidth: t.isComic ? 2 : 0, borderColor: t.isComic ? t.gold : 'transparent', alignItems: 'center', marginBottom: 10 },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: t.isComic ? t.gold : '#FFFFFF', fontSize: 15, fontWeight: '700', fontFamily: interFamily('700'), textTransform: t.isComic ? 'uppercase' : 'none', letterSpacing: t.isComic ? 0.5 : 0 },
    ghostBtn: { paddingVertical: 11, borderRadius: r, backgroundColor: 'transparent', borderWidth: 1, borderColor: t.isComic ? t.border : 'rgba(255,255,255,0.1)', alignItems: 'center' },
    ghostBtnText: { color: t.textSecondary, fontSize: 14, fontWeight: '600', fontFamily: interFamily('600') },
  });
}

function makeStylesResult(t: ThemeTokens) {
  const r = t.radius;
  return StyleSheet.create({
    resultWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
    resultIcon: { width: 64, height: 64, borderRadius: t.isComic ? 0 : 32, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: t.isComic ? 2 : 1 },
    resultIconText: { fontSize: 28, fontWeight: '800', fontFamily: interFamily('800') },
    iconSuccess: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' },
    iconError: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.22)' },
    iconWait: { backgroundColor: 'rgba(107,114,128,0.1)', borderColor: 'rgba(107,114,128,0.22)' },
    resultTitle: { fontSize: 19, fontWeight: '800', fontFamily: interFamily('800'), color: t.textPrimary, marginBottom: 10, textAlign: 'center' },
    resultBody: { fontSize: 14, color: t.textSecondary, lineHeight: 22, textAlign: 'center', marginBottom: 26, fontFamily: interFamily('400') },
    linkBtn: { paddingVertical: 6 },
    linkText: { color: t.textSecondary, fontSize: 13, textDecorationLine: 'underline', fontFamily: interFamily('400') },
    neutralBtn: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: r, backgroundColor: t.isComic ? t.surface : 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: t.isComic ? t.border : 'rgba(255,255,255,0.12)' },
    neutralText: { color: t.textPrimary, fontSize: 15, fontWeight: '700', fontFamily: interFamily('700') },
  });
}
