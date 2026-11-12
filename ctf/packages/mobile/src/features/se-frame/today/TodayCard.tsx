// One card in Today, the Android copy of the web's today-card.tsx. On an ask, offer or story,
// tapping the text opens the card in place as a sheet (CardSheet.tsx), and an answer button (I can
// help, I know someone, I'd like this, It helped me too) records the answer and opens the sheet;
// other buttons open the item. Every other card expands in place as before. The ••• menu holds Copy
// link, Not for me (the card leaves Today on this device), Mute this post (the card leaves Today and
// its conversation sends no notices) on somebody else's card and, on a card with an author, Mute and
// Report. Opening a card (its sheet, or expanding it) marks it read, which puts the check mark on its
// timeline dot; tapping the dot takes it away or puts it back. Another person's ask never shows a
// check mark, and its dot is not a button (3.1.0 plan, Card rules). A story or replay
// carries Save for later and Hide as icons in its button row, and the Mood card its five faces.

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import {
  SE_CARD_WORDS,
  SE_MUTE_WORDS,
  seCanSave,
  seCardAnswerKind,
  seIsMoodCard,
  seCardOpensSheet,
  seCardTakesCheckMark,
  seDailyCreditPill,
  seNewCommentsLine,
  type SeCardAnswerKind,
  type SeThemeTokens,
  type SeTodayCard,
} from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { authedFetch, getApiBaseUrl } from '../../../auth/authedFetch';
import { reportError } from '../../../observability/report';
import { SE_FONT } from '../fonts';
import { QuestionsPanel, isQuestionsCard } from './QuestionsPanel';
import { CardSheet } from './CardSheet';
import { MoodFaces, SaveHideIcons } from './CardQuickActions';
import { GoalCard } from './GoalCard';
import { CardFigures } from './CardFigures';
import { cardPath } from './useCardConversation';

function absolute(href: string): string {
  return href.startsWith('http') ? href : `${getApiBaseUrl()}${href}`;
}

type Styles = ReturnType<typeof makeStyles>;

const noop = () => undefined;

async function reportCard(card: SeTodayCard): Promise<string> {
  try {
    const res = await authedFetch(cardPath(card.id, '/report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ authorId: card.author?.accountId }),
    });
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    return res.ok ? SE_CARD_WORDS.reported : (data?.message ?? 'The report was not sent: the app could not be reached.');
  } catch (error) {
    reportError(error, { area: 'today-cards', op: 'report_card' });
    return 'The report was not sent: the app could not be reached.';
  }
}

function menuLabel(onMute: unknown, onMutePost: unknown, canReport: boolean): string {
  const items = ['copy link', 'not for me', ...(onMutePost ? ['mute this post'] : []), ...(onMute ? ['mute'] : []), ...(canReport ? ['report'] : [])];
  return `More: ${items.join(', ')}`;
}

// Mute this post is offered on every card but the member's own.
function mutePostFor(card: SeTodayCard, viewerId: string, onMutePost?: () => void): (() => void) | undefined {
  return card.author?.accountId === viewerId ? undefined : onMutePost;
}

type MenuProps = { s: Styles; card: SeTodayCard; canReport: boolean; onHide: () => void; onMute?: () => void; onMutePost?: () => void };

function CardMenu({ s, card, canReport, onHide, onMute, onMutePost }: MenuProps) {
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState<string | null>(null);
  return (
    <View style={s.menu} accessibilityRole="menu">
      <TouchableOpacity
        accessibilityRole="menuitem"
        style={s.menuItem}
        onPress={() => {
          void Clipboard.setStringAsync(absolute(card.href)).then(() => setCopied(true));
        }}
      >
        <Text style={s.menuLabel}>{copied ? 'Link copied' : 'Copy link'}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="menuitem" style={s.menuItem} onPress={onHide}>
        <Text style={s.menuLabel}>{SE_CARD_WORDS.notForMe}</Text>
      </TouchableOpacity>
      {onMutePost ? (
        <TouchableOpacity accessibilityRole="menuitem" style={s.menuItem} onPress={onMutePost}>
          <Text style={s.menuLabel}>{SE_MUTE_WORDS.mutePost}</Text>
        </TouchableOpacity>
      ) : null}
      {onMute && card.author ? (
        <TouchableOpacity accessibilityRole="menuitem" style={s.menuItem} onPress={onMute}>
          <Text style={s.menuLabel}>{SE_MUTE_WORDS.mutePerson(card.author.handle)}</Text>
        </TouchableOpacity>
      ) : null}
      {canReport ? (
        <TouchableOpacity accessibilityRole="menuitem" style={s.menuItem} disabled={reported !== null} onPress={() => void reportCard(card).then(setReported)}>
          <Text style={s.menuLabel}>{reported ?? SE_CARD_WORDS.report}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type ActionsProps = { s: Styles; card: SeTodayCard; onOpenLink: (_href: string) => void; onAnswer: ((_kind: SeCardAnswerKind) => void) | null };

function CardActions({ s, card, onOpenLink, onAnswer, trailing }: ActionsProps & { trailing?: React.ReactNode }) {
  if (card.actions.length === 0 && !trailing) return null;
  return (
    <View style={s.actions}>
      {card.actions.map((item) => {
        const answer = onAnswer ? seCardAnswerKind(item.kind) : null;
        return (
          <TouchableOpacity
            key={item.kind + item.label}
            accessibilityRole={answer ? 'button' : 'link'}
            style={s.action}
            onPress={() => (answer && onAnswer ? onAnswer(answer) : onOpenLink(item.href))}
          >
            <Text style={s.actionLabel}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
      {trailing}
    </View>
  );
}

function doneLabel(card: SeTodayCard, done: boolean): string {
  if (card.done) return `Done: ${card.title}`;
  return done ? `Done: ${card.title}. Tap to mark not done` : `Mark done: ${card.title}`;
}

type DotProps = { t: SeThemeTokens; s: ReturnType<typeof makeStyles>; card: SeTodayCard; read: boolean; color: string; onToggleDone: () => void };

// The timeline dot. A card the server marks done (a 21 Questions answer) stays done: the answer is final.
// On another person's ask it is only the dot.
function DoneDot({ t, s, card, read, color, onToggleDone }: DotProps) {
  if (!seCardTakesCheckMark(card)) return <View style={[s.dot, { backgroundColor: color }]} importantForAccessibility="no" />;
  const locked = card.done === true;
  const done = read || locked;
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: locked }}
      accessibilityLabel={doneLabel(card, done)}
      hitSlop={8}
      onPress={locked ? undefined : onToggleDone}
      disabled={locked}
      style={[s.dot, { backgroundColor: color }]}
    >
      {done ? (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M5 12l5 5 9-10" stroke={t.bg} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      ) : null}
    </TouchableOpacity>
  );
}

type TextProps = { t: SeThemeTokens; s: Styles; card: SeTodayCard; open: boolean; opensSheet: boolean; onPress: () => void };

function TitleAndBody({ s, card, open }: Pick<TextProps, 's' | 'card' | 'open'>) {
  return (
    <>
      <Text style={s.title}>{card.title}</Text>
      {card.body ? (
        <Text style={s.body} numberOfLines={open || card.source === 'questions' ? undefined : 3}>
          {card.body}
        </Text>
      ) : null}
    </>
  );
}

// The title and body, or the card's figures in their place (the title stays its name for a screen
// reader). On an ask, offer or story they open the sheet; on other cards they expand in place.
function CardText({ t, s, card, open, opensSheet, onPress }: TextProps) {
  const figures = Boolean(card.figures?.length);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={figures ? card.title : undefined}
      accessibilityState={opensSheet ? undefined : { expanded: open }}
      onPress={onPress}
      style={s.text}
    >
      {figures ? <CardFigures t={t} card={card} /> : <TitleAndBody s={s} card={card} open={open} />}
      {/* A story marked done that came back: comments were written in its conversation since. */}
      {card.newComments ? <Text style={s.newComments}>{seNewCommentsLine(card.newComments)}</Text> : null}
    </TouchableOpacity>
  );
}

// Under the text: the Mood faces on the Mood card, then the buttons, with Save and Hide on a story
// or replay.
function CardFoot({ t, onSave, onHide, ...rest }: ActionsProps & { t: SeThemeTokens; onSave?: () => void; onHide: () => void }) {
  const trailing = onSave && seCanSave(rest.card) ? <SaveHideIcons t={t} card={rest.card} onSave={onSave} onHide={onHide} /> : undefined;
  return (
    <>
      {seIsMoodCard(rest.card) ? <MoodFaces t={t} /> : null}
      <CardActions {...rest} trailing={trailing} />
    </>
  );
}

type Sheet = { firstAnswer: SeCardAnswerKind | null } | null;

export function TodayCard({
  t,
  card,
  viewerId,
  read,
  onToggleDone,
  onHide,
  onMute,
  onMutePost,
  onSave,
  onOpenLink,
  onChanged,
  onRead,
}: {
  t: SeThemeTokens;
  card: SeTodayCard;
  // The signed-in member, so the card offers Report only on somebody else's card.
  viewerId: string;
  read: boolean;
  onToggleDone: () => void;
  onHide: () => void;
  onMute?: () => void;
  // Mute this post: the card leaves Today and its conversation sends no notices.
  onMutePost?: () => void;
  // Save for later on a story or replay.
  onSave?: () => void;
  onOpenLink: (_href: string) => void;
  // A card that changes something (a 21 Questions answer) asks Today to read again.
  onChanged?: () => void;
  // Opening the card: Today marks it read (done) where the plan gives it a check mark.
  onRead?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const color = t.kind[card.kind];
  const s = makeStyles(t);
  const opensSheet = seCardOpensSheet(card);
  const canReport = Boolean(card.author && card.author.accountId !== viewerId);
  const openSheet = (firstAnswer: SeCardAnswerKind | null) => {
    onRead?.();
    setSheet({ firstAnswer });
  };
  const toggle = () => {
    if (opensSheet) return openSheet(null);
    if (!open) onRead?.();
    setOpen((value) => !value);
  };
  const mutePost = mutePostFor(card, viewerId, onMutePost);
  const credit = seDailyCreditPill(card, viewerId);

  const dot = <DoneDot t={t} s={s} card={card} read={read} color={color} onToggleDone={onToggleDone} />;
  if (card.goal) return <GoalCard t={t} card={{ ...card, goal: card.goal }} viewerId={viewerId} dot={dot} onOpenLink={onOpenLink} onChanged={onChanged} />;

  return (
    <View style={s.card}>
      {dot}
      <View style={s.head}>
        {card.author ? (
          <>
            <SeAvatar accountId={card.author.accountId} size={28} />
            <Text style={s.handle}>{card.author.handle}</Text>
          </>
        ) : null}
        <Text style={[s.label, { color }]}>{card.label}</Text>
        <View style={s.spacer} />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={menuLabel(onMute, mutePost, canReport)}
          accessibilityState={{ expanded: menu }}
          onPress={() => setMenu((value) => !value)}
          style={s.menuButton}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Circle cx={5} cy={12} r={1.8} fill={t.ink} />
            <Circle cx={12} cy={12} r={1.8} fill={t.ink} />
            <Circle cx={19} cy={12} r={1.8} fill={t.ink} />
          </Svg>
        </TouchableOpacity>
      </View>
      {menu ? <CardMenu s={s} card={card} canReport={canReport} onHide={onHide} onMute={onMute} onMutePost={mutePost} /> : null}
      <CardText t={t} s={s} card={card} open={open} opensSheet={opensSheet} onPress={toggle} />
      {credit ? <Text style={s.creditPill}>{credit}</Text> : null}
      {isQuestionsCard(card) ? <QuestionsPanel t={t} card={card} open={open} onOpen={() => setOpen(true)} onChanged={onChanged ?? noop} /> : null}
      <CardFoot t={t} s={s} card={card} onOpenLink={onOpenLink} onAnswer={opensSheet ? openSheet : null} onSave={onSave} onHide={onHide} />
      {sheet ? (
        <CardSheet
          t={t}
          card={card}
          viewerId={viewerId}
          firstAnswer={sheet.firstAnswer}
          onClose={() => setSheet(null)}
          onOpenLink={onOpenLink}
          onChanged={onChanged}
          onMutePost={mutePost}
        />
      ) : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    dot: { position: 'absolute', left: -40, top: 12, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    handle: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    label: { fontSize: 12, fontFamily: SE_FONT.sansBold, flexShrink: 1 },
    spacer: { flex: 1 },
    menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    menu: { alignSelf: 'flex-end', padding: 6, borderRadius: 14, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    menuItem: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    menuLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    text: { gap: 6 },
    title: { fontSize: 17, lineHeight: 22, color: t.ink, fontFamily: SE_FONT.sansBold },
    body: { fontSize: 14, lineHeight: 20, color: t.soft, fontFamily: SE_FONT.sans },
    newComments: { fontSize: 12, color: t.kind.story, fontFamily: SE_FONT.sansBold },
    // The day's credit card: the one ask that carries 1 ServiceCredit for the member who helps.
    creditPill: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: t.sunk, color: t.ink, fontSize: 12, fontFamily: SE_FONT.sansSemi },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    action: {
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
    },
    actionLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
  });
}
