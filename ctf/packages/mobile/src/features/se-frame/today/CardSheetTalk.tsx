// The conversation half of a card's sheet, the Android copy of the web's card-sheet-talk.tsx: the
// Public / Just us two switch, the messages, the requests to talk just you two, and the composer.
// Text only for now. A member's own message carries Edit (changes it in place, then shows Edited)
// and Delete (asks first, then removes it for everyone).

import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SE_CARD_MESSAGE_MAX, SE_CARD_WORDS, seAgo, type SeCardMessage, type SeCardPairThread, type SeThemeTokens } from '@ctf/shared';
import type { CardSheetStyles } from './cardSheetStyles';
import type { CardConversation } from './useCardConversation';

type TalkProps = {
  t: SeThemeTokens;
  s: CardSheetStyles;
  talk: CardConversation;
  // Null shows the public conversation; an account id (or '' before any pair exists) shows Just us two.
  partner: string | null;
  onPartner: (_partnerId: string | null) => void;
  onTalk: (_accountId: string) => void;
};

type BubbleProps = { s: CardSheetStyles; message: SeCardMessage; talk: CardConversation; onTalk: (_id: string) => void; publicThread: boolean };

function LinkButton({ s, label, disabled, onPress }: { s: CardSheetStyles; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" style={s.linkButton} disabled={disabled} onPress={onPress}>
      <Text style={s.linkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function OwnActions({ s, message, talk, onEdit }: { s: CardSheetStyles; message: SeCardMessage; talk: CardConversation; onEdit: () => void }) {
  const remove = () =>
    Alert.alert(SE_CARD_WORDS.delete, SE_CARD_WORDS.deleteConfirm, [
      { text: SE_CARD_WORDS.cancel, style: 'cancel' },
      { text: SE_CARD_WORDS.delete, style: 'destructive', onPress: () => void talk.remove(message.id) },
    ]);
  return (
    <>
      {!talk.locked ? <LinkButton s={s} label={SE_CARD_WORDS.edit} disabled={talk.busy} onPress={onEdit} /> : null}
      <LinkButton s={s} label={SE_CARD_WORDS.delete} disabled={talk.busy} onPress={remove} />
    </>
  );
}

function EditBubble({ s, message, talk, onDone }: { s: CardSheetStyles; message: SeCardMessage; talk: CardConversation; onDone: () => void }) {
  const [draft, setDraft] = useState(message.body);
  const text = draft.trim();
  const save = async () => {
    if (text === message.body) return onDone();
    if (await talk.edit(message.id, text)) onDone();
  };
  return (
    <View style={[s.bubbleRow, s.bubbleRowMine, s.bubbleRowEditing]}>
      <TextInput
        accessibilityLabel={SE_CARD_WORDS.editLabel}
        style={s.editBox}
        value={draft}
        maxLength={SE_CARD_MESSAGE_MAX}
        multiline
        onChangeText={setDraft}
      />
      <View style={s.meta}>
        <LinkButton s={s} label={SE_CARD_WORDS.cancel} onPress={onDone} />
        <LinkButton s={s} label={SE_CARD_WORDS.save} disabled={talk.busy || !text} onPress={() => void save()} />
      </View>
    </View>
  );
}

function OthersActions({ s, message, talk, onTalk, publicThread }: BubbleProps) {
  const [reported, setReported] = useState(false);
  if (talk.locked) return null;
  return (
    <>
      {publicThread ? <LinkButton s={s} label={SE_CARD_WORDS.askPair} onPress={() => onTalk(message.authorId)} /> : null}
      <LinkButton
        s={s}
        label={reported ? SE_CARD_WORDS.reported : SE_CARD_WORDS.reportMessage}
        disabled={reported}
        onPress={() => void talk.report({ messageId: message.id }).then(setReported)}
      />
    </>
  );
}

function bubbleLine(message: SeCardMessage): string {
  const who = message.mine ? SE_CARD_WORDS.you : message.handle;
  const edited = message.editedAtIso ? ` · ${SE_CARD_WORDS.edited}` : '';
  return `${who} · ${seAgo(message.createdAtIso)}${edited}`;
}

function Bubble(props: BubbleProps) {
  const { s, message, talk } = props;
  const [editing, setEditing] = useState(false);
  if (editing && message.mine) return <EditBubble s={s} message={message} talk={talk} onDone={() => setEditing(false)} />;
  return (
    <View style={[s.bubbleRow, message.mine ? s.bubbleRowMine : null]}>
      <View style={[s.bubble, message.mine ? s.bubbleMine : null]}>
        <Text style={[s.bubbleText, message.mine ? s.bubbleTextMine : null]}>{message.body}</Text>
      </View>
      <View style={s.meta}>
        <Text style={s.metaText}>{bubbleLine(message)}</Text>
        {message.mine ? <OwnActions s={s} message={message} talk={talk} onEdit={() => setEditing(true)} /> : <OthersActions {...props} />}
      </View>
    </View>
  );
}

function PairPills({ s, talk, pairs }: { s: CardSheetStyles; talk: CardConversation; pairs: SeCardPairThread[] }) {
  return (
    <>
      {pairs
        .filter((pair) => pair.state !== 'open')
        .map((pair) => (
          <View key={pair.partnerId} style={s.pill}>
            {pair.state === 'asked-me' ? (
              <>
                <Text style={s.pillText}>{SE_CARD_WORDS.askedMe(pair.partnerHandle)} · </Text>
                <TouchableOpacity accessibilityRole="button" disabled={talk.busy || talk.locked} onPress={() => void talk.agree(pair.partnerId)}>
                  <Text style={s.pillAgree}>{SE_CARD_WORDS.agree}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={s.pillText}>{SE_CARD_WORDS.waiting(pair.partnerHandle)}</Text>
            )}
          </View>
        ))}
    </>
  );
}

function Toggle({ s, on, label, onPress }: { s: CardSheetStyles; on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: on }} style={on ? s.switchOn : s.switchOff} onPress={onPress}>
      <Text style={on ? s.switchOnLabel : s.switchOffLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Switch({ s, partner, pairs, onPartner }: Pick<TalkProps, 's' | 'partner' | 'onPartner'> & { pairs: SeCardPairThread[] }) {
  return (
    <View style={s.talkHead}>
      <Text style={s.talkTitle}>{SE_CARD_WORDS.conversation}</Text>
      <View accessibilityLabel={SE_CARD_WORDS.whoReads} style={s.switch}>
        <Toggle s={s} on={partner === null} label={SE_CARD_WORDS.public} onPress={() => onPartner(null)} />
        <Toggle s={s} on={partner !== null} label={SE_CARD_WORDS.pair} onPress={() => onPartner(partner ?? pairs[0]?.partnerId ?? '')} />
      </View>
    </View>
  );
}

function PartnerChips({ s, partner, pairs, onPartner }: Pick<TalkProps, 's' | 'onPartner'> & { partner: string; pairs: SeCardPairThread[] }) {
  if (pairs.length < 2) return null;
  return (
    <View accessibilityLabel={SE_CARD_WORDS.pair} style={s.switch}>
      {pairs.map((pair) => (
        <Toggle key={pair.partnerId} s={s} on={pair.partnerId === partner} label={pair.partnerHandle} onPress={() => onPartner(pair.partnerId)} />
      ))}
    </View>
  );
}

function Composer({ t, s, talk, partnerId, hint }: { t: SeThemeTokens; s: CardSheetStyles; talk: CardConversation; partnerId: string | null; hint: string }) {
  const [draft, setDraft] = useState('');
  if (talk.locked) return <Text style={s.hint}>{talk.lockLine}</Text>;
  const disabled = talk.busy || !draft.trim();
  const submit = async () => {
    if (draft.trim() && (await talk.write(draft.trim(), partnerId))) setDraft('');
  };
  return (
    <>
      <View style={s.composer}>
        <TextInput
          accessibilityLabel="Message"
          style={s.input}
          value={draft}
          maxLength={SE_CARD_MESSAGE_MAX}
          placeholder={SE_CARD_WORDS.composer}
          placeholderTextColor={t.soft}
          onChangeText={setDraft}
        />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={SE_CARD_WORDS.send} accessibilityState={{ disabled }} disabled={disabled} style={[s.send, disabled ? s.dim : null]} onPress={() => void submit()}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M5 12h14M13 6l6 6-6 6" stroke={t.onBtn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </TouchableOpacity>
      </View>
      <Text style={s.hint}>{hint}</Text>
    </>
  );
}

type MessagesProps = { s: CardSheetStyles; messages: SeCardMessage[]; empty: string; talk: CardConversation; onTalk: (_id: string) => void; publicThread: boolean };

function Messages({ s, messages, empty, talk, onTalk, publicThread }: MessagesProps) {
  if (messages.length === 0) return <Text style={s.quiet}>{empty}</Text>;
  return (
    <>
      {messages.map((message) => (
        <Bubble key={message.id} s={s} message={message} talk={talk} onTalk={onTalk} publicThread={publicThread} />
      ))}
    </>
  );
}

function PairView({ s, talk, thread }: { s: CardSheetStyles; talk: CardConversation; thread: SeCardPairThread | undefined }) {
  if (!thread) return <Text style={s.quiet}>{SE_CARD_WORDS.pairNone}</Text>;
  if (thread.state !== 'open') return <PairPills s={s} talk={talk} pairs={[thread]} />;
  return <Messages s={s} messages={thread.messages} empty={SE_CARD_WORDS.noPairMessages} talk={talk} onTalk={() => undefined} publicThread={false} />;
}

type ThreadProps = {
  s: CardSheetStyles;
  talk: CardConversation;
  partner: string | null;
  pairs: SeCardPairThread[];
  thread: SeCardPairThread | undefined;
  onTalk: (_id: string) => void;
};

function Thread({ s, talk, partner, pairs, thread, onTalk }: ThreadProps) {
  const conversation = talk.conversation;
  if (!conversation) return talk.note || talk.locked ? null : <Text style={s.quiet}>{SE_CARD_WORDS.loading}</Text>;
  if (partner !== null) return <PairView s={s} talk={talk} thread={thread} />;
  return (
    <>
      <Messages s={s} messages={conversation.messages} empty={SE_CARD_WORDS.noMessages} talk={talk} onTalk={onTalk} publicThread />
      <PairPills s={s} talk={talk} pairs={pairs} />
    </>
  );
}

type FootProps = { t: SeThemeTokens; s: CardSheetStyles; talk: CardConversation; partner: string | null; thread: SeCardPairThread | undefined };

function Foot({ t, s, talk, partner, thread }: FootProps) {
  const openThread = thread?.state === 'open' ? thread : null;
  if (partner !== null && !openThread && !talk.locked) return null;
  const hint = openThread ? SE_CARD_WORDS.pairHint(openThread.partnerHandle) : SE_CARD_WORDS.publicHint;
  return <Composer t={t} s={s} talk={talk} partnerId={openThread?.partnerId ?? null} hint={hint} />;
}

export function CardTalk({ t, s, talk, partner, onPartner, onTalk }: TalkProps) {
  const pairs = talk.conversation?.pairs ?? [];
  const thread = pairs.find((pair) => pair.partnerId === partner);
  return (
    <View style={s.talk}>
      <Switch s={s} partner={partner} pairs={pairs} onPartner={onPartner} />
      {partner !== null ? <PartnerChips s={s} partner={partner} pairs={pairs} onPartner={onPartner} /> : null}
      <View style={s.messages}>
        <Thread s={s} talk={talk} partner={partner} pairs={pairs} thread={thread} onTalk={onTalk} />
        {talk.note ? (
          <Text accessibilityLiveRegion="polite" style={s.quiet}>
            {talk.note}
          </Text>
        ) : null}
      </View>
      <Foot t={t} s={s} talk={talk} partner={partner} thread={thread} />
    </View>
  );
}
