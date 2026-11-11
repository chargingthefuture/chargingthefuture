// A card opened on signed-out Today, the Android copy of the web's guest-sheet.tsx (owner decision,
// 2026-11-10): read only. A story shows its post's Fireside comments; a sample ask or offer shows a
// sample conversation, tagged as sample. Just us two is shown as private, with a sign-in.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_CARD_WORDS, SE_GUEST_WORDS as W, seAgo, type SeGuestConversation, type SeThemeTokens, type SeTodayCard } from '@ctf/shared';
import { getApiBaseUrl } from '../../../auth/authedFetch';
import { makeCardSheetStyles, type CardSheetStyles } from './cardSheetStyles';

type Read = { kind: 'loading' } | { kind: 'ready'; conversation: SeGuestConversation } | { kind: 'failed'; message: string };

function useGuestConversation(cardId: string): Read {
  const [read, setRead] = useState<Read>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    fetch(`${getApiBaseUrl()}/api/today/public/cards/${encodeURIComponent(cardId)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { conversation?: SeGuestConversation; message?: string } | null;
        if (!live) return;
        if (res.ok && body?.conversation) setRead({ kind: 'ready', conversation: body.conversation });
        else setRead({ kind: 'failed', message: body?.message ?? `The conversation did not load (status ${res.status}).` });
      })
      .catch((error: unknown) => live && setRead({ kind: 'failed', message: `The conversation did not load: ${error instanceof Error ? error.message : String(error)}` }));
    return () => {
      live = false;
    };
  }, [cardId]);
  return read;
}

function Messages({ s, read, sampleTag }: { s: CardSheetStyles; read: Read; sampleTag: React.ReactNode }) {
  if (read.kind === 'loading') return <Text style={s.quiet}>{W.loadingConversation}</Text>;
  if (read.kind === 'failed') return <Text accessibilityRole="alert" style={s.quiet}>{read.message}</Text>;
  if (read.conversation.messages.length === 0) return <Text style={s.quiet}>{W.noMessages}</Text>;
  return (
    <>
      {read.conversation.sample ? sampleTag : null}
      {read.conversation.messages.map((message) => (
        <View key={message.id} style={s.bubbleRow}>
          <View style={s.bubble}>
            <Text style={s.bubbleText}>{message.body}</Text>
          </View>
          <Text style={s.metaText}>
            {message.handle} · {seAgo(message.createdAtIso)}
            {message.editedAtIso ? ` · ${SE_CARD_WORDS.edited}` : ''}
          </Text>
        </View>
      ))}
    </>
  );
}

export function GuestSheet({ t, card, sampleTag, onSignIn, onClose }: { t: SeThemeTokens; card: SeTodayCard; sampleTag: React.ReactNode; onSignIn: () => void; onClose: () => void }) {
  const s = makeCardSheetStyles(t);
  const read = useGuestConversation(card.id);
  const [pair, setPair] = useState(false);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel={W.close} style={{ height: 64 }} onPress={onClose} />
        <View style={s.sheet} accessibilityViewIsModal accessibilityLabel={`${card.label}: ${card.title}`}>
          <ScrollView contentContainerStyle={s.content}>
            <View style={s.grip} />
            <View style={s.head}>
              <Text style={s.talkTitle}>{card.label}</Text>
              <View style={s.spacer} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} style={s.round} onPress={onClose}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </TouchableOpacity>
            </View>
            <View style={s.text}>
              <Text accessibilityRole="header" style={s.title}>
                {card.title}
              </Text>
              {card.body ? <Text style={s.body}>{card.body}</Text> : null}
            </View>
            <View style={s.talk}>
              <View style={s.talkHead}>
                <Text style={s.talkTitle}>{W.conversation}</Text>
                <View style={s.switch} accessibilityLabel={SE_CARD_WORDS.whoReads}>
                  <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: !pair }} style={!pair ? s.switchOn : s.switchOff} onPress={() => setPair(false)}>
                    <Text style={!pair ? s.switchOnLabel : s.switchOffLabel}>{SE_CARD_WORDS.public}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: pair }} style={pair ? s.switchOn : s.switchOff} onPress={() => setPair(true)}>
                    <Text style={pair ? s.switchOnLabel : s.switchOffLabel}>{SE_CARD_WORDS.pair}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={s.messages}>{pair ? <Text style={s.quiet}>{W.pairEmpty}</Text> : <Messages s={s} read={read} sampleTag={sampleTag} />}</View>
              <TouchableOpacity accessibilityRole="button" style={[s.talkPrimary, { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }]} onPress={onSignIn}>
                <Text style={s.talkPrimaryLabel}>{pair ? W.pairSignIn : W.signInToWrite}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
