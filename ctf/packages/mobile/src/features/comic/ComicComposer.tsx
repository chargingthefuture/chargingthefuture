import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, type ThemeTokens } from '../../theme';
import { ComicConsentSheet } from './ComicConsentSheet';
import { mentionsComic, sendComicMessage } from './api';

// Single-field @comic mention composer (no post/ask toggle), matching the locked MobileHome
// composer: an @comic chip + the helper "Type @comic to ask the AI Assistant". Typing @comic … and
// sending routes to the assistant; the asker sees only a safe holding state (every answer is human-
// reviewed first). First use opens the consent bottom sheet before anything is sent.
//
// CYAN is the @comic AI-assistant accent. It is deliberately kept raw: the comic theme remaps this
// slug to inkDim (getAppAccent('comic','comic')), a value change that is out of scope for this
// byte-identical token pass, so the assistant cyan stays constant while chrome reads theme tokens.
const CYAN = '#38BDF8';

type ComicComposerProps = {
  // Called after a successful @comic send so the host stream can show an optimistic pending card.
  onAsked: () => void;
};

export function ComicComposer({ onAsked }: ComicComposerProps) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  // Whether consent has been granted this session; the server is the source of truth, but we pass
  // the flag so the first successful send records it.
  const [consentGranted, setConsentGranted] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);

  const submit = useCallback(
    async (text: string, consent: boolean) => {
      setSending(true);
      setError(null);
      setInfo(null);
      try {
        const result = await sendComicMessage(text, consent);
        if (!result.routedToAssistant) {
          setInfo('Add @comic to your message to ask the AI Assistant.');
          return;
        }
        setInput('');
        onAsked();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unable to reach the AI Assistant.';
        if (message === 'consent_required') {
          // Server still needs consent — surface the sheet and keep the text to retry on confirm.
          setPendingText(text);
          setConsentOpen(true);
          return;
        }
        setError(message);
      } finally {
        setSending(false);
      }
    },
    [onAsked],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || sending) return;

    if (!mentionsComic(text)) {
      setInfo('Add @comic to your message to ask the AI Assistant.');
      return;
    }

    if (!consentGranted) {
      // First use: gate on the consent sheet before sending.
      setPendingText(text);
      setConsentOpen(true);
      return;
    }

    submit(text, true);
  }, [input, sending, consentGranted, submit]);

  const handleConsentConfirm = useCallback(() => {
    setConsentGranted(true);
    setConsentOpen(false);
    const text = pendingText ?? input.trim();
    setPendingText(null);
    if (text) {
      submit(text, true);
    }
  }, [pendingText, input, submit]);

  const handleConsentDismiss = useCallback(() => {
    setConsentOpen(false);
    setPendingText(null);
  }, []);

  const isAsk = mentionsComic(input);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.wrap}>
        <View style={s.helperRow}>
          <View style={s.chip}>
            <Ionicons name="at" size={11} color={CYAN} />
            <Text style={s.chipText}>comic</Text>
          </View>
          <Text style={s.helperText}>
            Type <Text style={s.helperStrong}>@comic</Text> to ask the AI Assistant
          </Text>
        </View>

        {error && <Text style={s.error}>{error}</Text>}
        {info && <Text style={s.info}>{info}</Text>}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={(value) => {
              setInput(value);
              if (info) setInfo(null);
            }}
            placeholder="Share, or type @comic to ask…"
            placeholderTextColor={tokens.textMuted}
            multiline
            editable={!sending}
          />
          <Pressable
            style={[s.sendBtn, isAsk && input.trim() ? s.sendBtnActive : null]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={14} color={isAsk && input.trim() ? '#fff' : tokens.textMuted} />
            )}
          </Pressable>
        </View>
      </View>

      <ComicConsentSheet open={consentOpen} onConfirm={handleConsentConfirm} onDismiss={handleConsentDismiss} />
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: t.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: t.radiusChip,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: CYAN,
  },
  helperText: {
    fontSize: 11,
    color: t.textSecondary,
    flex: 1,
  },
  helperStrong: {
    color: CYAN,
    fontWeight: '600',
  },
  error: {
    fontSize: 12,
    color: '#F87171',
    marginBottom: 8,
  },
  info: {
    fontSize: 12,
    color: '#7DD3FC',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 28,
    fontSize: 14,
    color: t.textShell,
    paddingVertical: 2,
  },
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: t.borderFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: CYAN,
  },
  });
}
