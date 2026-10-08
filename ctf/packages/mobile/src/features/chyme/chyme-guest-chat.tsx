// The room chat for a signed-out visitor, copied from the web (web components/chyme/
// chyme-guest-chat.tsx): the same messages members see, read-only, closed until opened, re-read
// every 10 seconds while open, with one way in — sign in to chat.

import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronRight, Hash, LogIn } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { chymeHandle } from './ChymeApi';
import { formatSentAt } from './chyme-chat-panel';
import { readPublicChat, type ChatState } from './chyme-public-api';
import { useChymeTokens } from './chyme-tokens';

const POLL_MS = 10_000;

function useGuestChat(open: boolean, refreshKey: number): ChatState {
  const [state, setState] = useState<ChatState>({ kind: 'loading' });
  useEffect(() => {
    if (!open) return;
    let canceled = false;
    const load = async () => {
      try {
        const next = await readPublicChat();
        if (!canceled) setState(next);
      } catch (error) {
        if (!canceled) setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
      }
    };
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      canceled = true;
      clearInterval(id);
    };
  }, [open, refreshKey]);
  return state;
}

function GuestChatBody({ state }: { state: ChatState }) {
  const t = useChymeTokens();
  if (state.kind === 'loading') return <Text style={[styles.plain, { color: t.FAINT }]}>Loading the room chat…</Text>;
  if (state.kind === 'error') return <Text style={[styles.small, { color: t.MUTED }]}>Couldn&apos;t load the room chat. {state.message}</Text>;
  if (state.messages.length === 0) return <Text style={[styles.plain, { color: t.FAINT }]}>No messages yet.</Text>;
  return (
    <>
      {state.messages.map((message) => (
        <View key={message.id} style={styles.message}>
          <View style={styles.meta}>
            <Text style={styles.author}>{chymeHandle(message.username, message.userId)}</Text>
            <Text style={styles.time}>{formatSentAt(message.sentAtIso)}</Text>
          </View>
          <Text style={[styles.text, { color: t.SUBTLE }]}>{message.text}</Text>
        </View>
      ))}
    </>
  );
}

export function ChymeGuestChat({ onSignIn, refreshKey }: { onSignIn: () => void; refreshKey: number }) {
  const t = useChymeTokens();
  const [open, setOpen] = useState(false);
  const state = useGuestChat(open, refreshKey);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <View style={[styles.box, { borderRadius: t.radius(12), borderColor: t.BORDER, backgroundColor: t.HEADER }]}>
      <TouchableOpacity onPress={() => setOpen((was) => !was)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.toggle}>
        <Hash size={14} color={t.ACCENT} />
        <Text style={[styles.title, { color: t.TITLE }]}>Room Chat</Text>
        <Text style={[styles.hint, { color: t.MUTED }]}>{open ? 'read-only' : 'read what members are saying'}</Text>
        <Chevron size={16} color={t.MUTED} />
      </TouchableOpacity>
      {open ? (
        <>
          <ScrollView nestedScrollEnabled style={[styles.body, { borderTopColor: t.BORDER, maxHeight: Dimensions.get('window').height * 0.4 }]} contentContainerStyle={styles.bodyContent}>
            <GuestChatBody state={state} />
          </ScrollView>
          <TouchableOpacity onPress={onSignIn} accessibilityRole="button" style={[styles.signIn, { borderTopColor: t.BORDER }]}>
            <LogIn size={13} color={t.ACCENT} />
            <Text style={[styles.signInText, { color: t.ACCENT }]}>Sign in to chat</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, overflow: 'hidden' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14 },
  title: { fontSize: 14, fontFamily: interFamily('600') },
  hint: { marginLeft: 'auto', fontSize: 11, fontFamily: interFamily('400') },
  body: { borderTopWidth: 1 },
  bodyContent: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 120 },
  plain: { fontSize: 13, fontFamily: interFamily('400') },
  small: { fontSize: 12, lineHeight: 18, fontFamily: interFamily('400') },
  message: { marginBottom: 14 },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  author: { fontSize: 13, color: '#A7F3D0', fontFamily: interFamily('600') },
  time: { fontSize: 11, color: '#374151', fontFamily: interFamily('400') },
  text: { fontSize: 13, lineHeight: 19.5, fontFamily: interFamily('400') },
  signIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1 },
  signInText: { fontSize: 12, fontFamily: interFamily('700') },
});
