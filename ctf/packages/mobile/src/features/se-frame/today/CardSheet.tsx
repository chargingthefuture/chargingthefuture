// A Today card opened in place, the Android copy of the web's card-sheet.tsx (the approved 3.1
// board "a card opened in place"): a full-height sheet over Today with the author, Share, ••• and
// Close; the title and body; who answered and how, each with Talk here; then the conversation,
// public or Just us two.

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SE_CARD_WORDS, seCardSheetLine, type SeCardAnswerKind, type SeCardConversation, type SeThemeTokens, type SeTodayCard } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { getApiBaseUrl } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';
import { CardTalk } from './CardSheetTalk';
import { SheetYours } from './CardSheetYours';
import { makeCardSheetStyles, type CardSheetStyles } from './cardSheetStyles';
import { useCardConversation, type CardConversation } from './useCardConversation';

export function absoluteCardLink(href: string): string {
  return href.startsWith('http') ? href : `${getApiBaseUrl()}${href}`;
}

async function shareCard(card: SeTodayCard) {
  const url = absoluteCardLink(card.href);
  try {
    await Share.share({ message: url, url, title: card.title });
  } catch (error) {
    reportError(error, { area: 'today-cards', op: 'share' });
  }
}

type HeadProps = { t: SeThemeTokens; s: CardSheetStyles; card: SeTodayCard; viewerId: string; talk: CardConversation; onClose: () => void };

function ReportMenu({ s, card, viewerId, talk }: Omit<HeadProps, 't' | 'onClose'>) {
  const [done, setDone] = useState(false);
  if (!card.author || card.author.accountId === viewerId) return null;
  const authorId = card.author.accountId;
  return (
    <View style={s.menu} accessibilityRole="menu">
      <TouchableOpacity accessibilityRole="menuitem" style={s.menuItem} disabled={done} onPress={() => void talk.report({ authorId }).then(setDone)}>
        <Text style={s.menuLabel}>{done ? SE_CARD_WORDS.reported : SE_CARD_WORDS.report}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SheetHead({ t, s, card, viewerId, talk, onClose }: HeadProps) {
  const [menu, setMenu] = useState(false);
  const canReport = Boolean(card.author && card.author.accountId !== viewerId);
  return (
    <>
      <View style={s.head}>
        {card.author ? <SeAvatar accountId={card.author.accountId} size={32} /> : null}
        <View style={s.who}>
          {card.author ? <Text style={s.handle}>{card.author.handle}</Text> : null}
          <Text style={[s.when, { color: t.kind[card.kind] }]}>{seCardSheetLine(card)}</Text>
        </View>
        <View style={s.spacer} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={SE_CARD_WORDS.share} style={s.round} onPress={() => void shareCard(card)}>
          <Svg width={17} height={17} viewBox="0 0 24 24">
            <Path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke={t.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </TouchableOpacity>
        {canReport ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={SE_CARD_WORDS.more} accessibilityState={{ expanded: menu }} style={s.round} onPress={() => setMenu((value) => !value)}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Circle cx={5} cy={12} r={1.8} fill={t.ink} />
              <Circle cx={12} cy={12} r={1.8} fill={t.ink} />
              <Circle cx={19} cy={12} r={1.8} fill={t.ink} />
            </Svg>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={SE_CARD_WORDS.close} style={s.round} onPress={onClose}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          </Svg>
        </TouchableOpacity>
      </View>
      {menu ? <ReportMenu s={s} card={card} viewerId={viewerId} talk={talk} /> : null}
    </>
  );
}

function Answers({ s, conversation, onTalk }: { s: CardSheetStyles; conversation: SeCardConversation; onTalk: (_id: string) => void }) {
  if (conversation.answers.length === 0) return null;
  return (
    <View style={s.answers}>
      <Text style={s.answersTitle}>{SE_CARD_WORDS.answered(conversation.answers.length)}</Text>
      {conversation.answers.map((answer, index) => {
        const mine = answer.accountId === conversation.viewerId;
        return (
          <View key={answer.accountId} style={s.answer}>
            <SeAvatar accountId={answer.accountId} size={30} />
            <Text style={s.answerText}>
              <Text style={s.answerName}>{mine ? SE_CARD_WORDS.you : answer.handle}</Text> {SE_CARD_WORDS.answerLine(answer.kinds)}
            </Text>
            {mine ? null : (
              <TouchableOpacity accessibilityRole="button" style={index === 0 ? s.talkPrimary : s.talkButton} onPress={() => onTalk(answer.accountId)}>
                <Text style={index === 0 ? s.talkPrimaryLabel : s.talkLabel}>{SE_CARD_WORDS.talkHere}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

type SheetProps = {
  t: SeThemeTokens;
  card: SeTodayCard;
  viewerId: string;
  firstAnswer: SeCardAnswerKind | null;
  onClose: () => void;
  onOpenLink: (_href: string) => void;
  onChanged?: () => void;
};

export function CardSheet({ t, card, viewerId, firstAnswer, onClose, onOpenLink, onChanged }: SheetProps) {
  const s = makeCardSheetStyles(t);
  const talk = useCardConversation(card.id, firstAnswer);
  const [partner, setPartner] = useState<string | null>(null);
  const talkTo = async (accountId: string) => {
    const open = talk.conversation?.pairs.some((pair) => pair.partnerId === accountId);
    if (open || (await talk.ask(accountId))) setPartner(accountId);
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel={SE_CARD_WORDS.close} style={{ height: 64 }} onPress={onClose} />
        <View style={s.sheet} accessibilityViewIsModal accessibilityLabel={`${card.label}: ${card.title}`}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <View style={s.grip} />
            <SheetHead t={t} s={s} card={card} viewerId={viewerId} talk={talk} onClose={onClose} />
            <View style={s.text}>
              <Text accessibilityRole="header" style={s.title}>
                {card.title}
              </Text>
              {card.body ? <Text style={s.body}>{card.body}</Text> : null}
              <TouchableOpacity accessibilityRole="link" style={s.openIn} onPress={() => (onClose(), onOpenLink(card.href))}>
                <Text style={s.openInLabel}>{SE_CARD_WORDS.openIn(card.source)}</Text>
              </TouchableOpacity>
            </View>
            <SheetYours s={s} card={card} onChanged={onChanged} />
            {talk.conversation ? <Answers s={s} conversation={talk.conversation} onTalk={(id) => void talkTo(id)} /> : null}
            <CardTalk t={t} s={s} talk={talk} partner={partner} onPartner={setPartner} onTalk={(id) => void talkTo(id)} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
