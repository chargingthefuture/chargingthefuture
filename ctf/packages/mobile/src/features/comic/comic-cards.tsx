import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, type ThemeTokens } from '../../theme';
import type { ComicAnswerRating, ComicStreamItem } from './api';

// AI Assistant accent. Standard theme uses cyan (the locked MobileHome ai_qa / ai_pending mockup);
// comic theme uses ink-dim #7A6A50 — no blue in comic theme (COMIC_THEME_TOKENS.md §6, §9.3). The
// accent is resolved per-render from the active theme, never hardcoded, so it follows the toggle.
const AI_ACCENT_STANDARD = '#38BDF8';
const AI_ACCENT_COMIC = '#7A6A50';
const TEXT = '#F9FAFB';
const BODY = '#D1D5DB';
const SUBTLE = '#9CA3AF';
const DIM = '#4B5563';

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffMin = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

function CardHead({ askedByLabel, time, accent }: { askedByLabel: string; time: string; accent: string }) {
  const { tokens } = useTheme();
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={styles.head}>
      <View style={styles.avatar}>
        <Ionicons name="sparkles" size={14} color={accent} />
      </View>
      <View style={styles.titleWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>AI Assistant</Text>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: accent }]}>🤖 AI Q&A</Text>
          </View>
        </View>
        <Text style={styles.meta}>Asked by {askedByLabel} · {time}</Text>
      </View>
    </View>
  );
}

type ComicAnswerCardProps = {
  item: ComicStreamItem;
  askedByLabel: string;
  onRate: (_turnId: string, _rating: ComicAnswerRating) => void;
};

// Answered AI Assistant card: theme-aware accent (cyan in standard, ink-dim in comic), Sparkles
// avatar, "AI Assistant" label, 🤖 AI Q&A badge, Q/A layout, and a helpful / not helpful / flag row.
export function ComicAnswerCard({ item, askedByLabel, onRate }: ComicAnswerCardProps) {
  const { tokens } = useTheme();
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);
  const accent = tokens.isComic ? AI_ACCENT_COMIC : AI_ACCENT_STANDARD;
  const ratable = item.answerTurnId !== null;
  const rating = item.currentUserRating;

  return (
    <View style={[styles.card, styles.answerCard]}>
      <CardHead askedByLabel={askedByLabel} time={formatTime(item.askedAtIso)} accent={accent} />

      <View style={styles.questionBox}>
        <Text style={styles.bodyText}>
          <Text style={[styles.qaLabel, { color: accent }]}>Q: </Text>
          {item.question}
        </Text>
      </View>

      <Text style={styles.answerText}>
        <Text style={[styles.qaLabel, { color: accent }]}>A: </Text>
        {item.answer}
      </Text>

      {item.linkedPlugins.length > 0 ? (
        <View style={styles.linkedPluginsRow}>
          {item.linkedPlugins.map((plugin) => (
            <View
              key={plugin.slug}
              style={[styles.linkedPluginChip, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}
            >
              <Ionicons name="link" size={10} color={accent} />
              <Text style={[styles.linkedPluginText, { color: accent }]}>{plugin.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {ratable && item.answerTurnId ? (
        <View style={styles.ratingRow}>
          <Pressable
            style={[styles.rateBtn, rating === 'helpful' ? styles.rateBtnUp : null]}
            onPress={() => onRate(item.answerTurnId as string, 'helpful')}
          >
            <Ionicons
              name={rating === 'helpful' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={12}
              color={rating === 'helpful' ? '#4ADE80' : SUBTLE}
            />
            <Text style={[styles.rateText, rating === 'helpful' ? styles.rateTextUp : null]}>Helpful</Text>
          </Pressable>
          <Pressable
            style={[styles.rateBtn, rating === 'not_helpful' ? styles.rateBtnDown : null]}
            onPress={() => onRate(item.answerTurnId as string, 'not_helpful')}
          >
            <Ionicons
              name={rating === 'not_helpful' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={12}
              color={rating === 'not_helpful' ? '#CBD5E1' : SUBTLE}
            />
            <Text style={[styles.rateText, rating === 'not_helpful' ? styles.rateTextDown : null]}>Not helpful</Text>
          </Pressable>
          <Pressable
            style={[styles.flagBtn, rating === 'flagged' ? styles.flagBtnActive : null]}
            onPress={() => onRate(item.answerTurnId as string, 'flagged')}
            accessibilityRole="button"
            accessibilityLabel="Flag answer"
          >
            <Ionicons
              name={rating === 'flagged' ? 'flag' : 'flag-outline'}
              size={11}
              color={rating === 'flagged' ? '#F87171' : DIM}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type ComicPendingCardProps = {
  item: ComicStreamItem;
  askedByLabel: string;
};

// Pending "Reviewing for safety" card. CRITICAL INVARIANT: the asker only ever sees this card for
// an in-flight @comic question — never an unreviewed AI draft. The server enforces this; this card
// reflects that holding state.
export function ComicPendingCard({ item, askedByLabel }: ComicPendingCardProps) {
  const { tokens } = useTheme();
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);
  const accent = tokens.isComic ? AI_ACCENT_COMIC : AI_ACCENT_STANDARD;
  return (
    <View style={[styles.card, styles.pendingCard]}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color={accent} />
        </View>
        <View style={styles.titleWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>AI Assistant</Text>
            <View style={styles.pendingBadge}>
              <Ionicons name="shield-checkmark" size={9} color="#7DD3FC" />
              <Text style={styles.pendingBadgeText}>Reviewing</Text>
            </View>
          </View>
          <Text style={styles.meta}>Asked by {askedByLabel} · {formatTime(item.askedAtIso)}</Text>
        </View>
      </View>

      <View style={styles.questionBox}>
        <Text style={styles.bodyText}>
          <Text style={styles.qaLabel}>Q: </Text>
          {item.question}
        </Text>
      </View>

      <Text style={styles.pendingText}>
        AI Assistant is preparing an answer — a teammate is reviewing it for safety before it&apos;s posted.
      </Text>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
  },
  answerCard: {
    backgroundColor: 'rgba(14,165,233,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.16)',
  },
  pendingCard: {
    backgroundColor: 'rgba(14,165,233,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
    borderStyle: 'dashed',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: AI_ACCENT_STANDARD,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(14,165,233,0.1)',
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7DD3FC',
  },
  meta: {
    fontSize: 11,
    color: DIM,
    marginTop: 1,
  },
  questionBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  qaLabel: {
    color: AI_ACCENT_STANDARD,
    fontWeight: '600',
  },
  bodyText: {
    fontSize: 12,
    color: t.textSecondary,
    lineHeight: 18,
  },
  answerText: {
    fontSize: 13,
    color: BODY,
    lineHeight: 21,
  },
  linkedPluginsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  linkedPluginChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${AI_ACCENT_STANDARD}12`,
    borderWidth: 1,
    borderColor: `${AI_ACCENT_STANDARD}30`,
  },
  linkedPluginText: { fontSize: 11, fontWeight: '600', color: AI_ACCENT_STANDARD },
  pendingText: {
    fontSize: 12,
    color: '#7DD3FC',
    lineHeight: 19,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(14,165,233,0.12)',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rateBtnUp: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  rateBtnDown: {
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderColor: 'rgba(148,163,184,0.4)',
  },
  rateText: {
    fontSize: 11,
    fontWeight: '600',
    color: t.textSecondary,
  },
  rateTextUp: {
    color: '#4ADE80',
  },
  rateTextDown: {
    color: '#CBD5E1',
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    marginLeft: 'auto',
  },
  flagBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  });
}
