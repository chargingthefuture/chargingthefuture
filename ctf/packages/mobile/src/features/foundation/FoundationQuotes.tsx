// The Quotes tab, copied from the web QuotesPanel and QuoteCard (foundation-panels.tsx): the heading,
// the empty state with its three steps, and each quote with its status, Direct Line, price, the delivery
// step, "Is this ongoing?" and the provider's price form.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, FileText, MessageSquare, Wrench } from 'lucide-react-native';
import type { QuoteState, QuoteView } from './FoundationDataApi';
import type { QuoteTransitionResult } from './useFoundationData';
import { FDButton } from './FDButton';
import { QuoteCloseForm, QuoteRespondForm, formatQuotedPrice } from './FoundationQuoteForms';
import { MarkRecurringControl } from './MarkRecurringControl';
import { FOUNDATION_COLOR, alpha, font, useFDTheme } from './useFDTheme';

const EMPTY_STEPS = [
  'Request an electrician, plumber, or other trade',
  'Get quotes from community providers',
  'Accept a quote and send ServiceCredits',
];

const QUOTE_STATUS: Record<QuoteState, { label: string; fg: string; bg: string; bd: string }> = {
  requested: { label: 'Pending', fg: FOUNDATION_COLOR, bg: `${FOUNDATION_COLOR}15`, bd: `${FOUNDATION_COLOR}30` },
  provider_responded: { label: 'Responded', fg: '#22C55E', bg: '#22C55E20', bd: '#22C55E40' },
  closed: { label: 'Closed', fg: '#6B7280', bg: 'rgba(255,255,255,0.04)', bd: 'rgba(255,255,255,0.08)' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The web formatQuoteDate: "Oct 8, 2026".
function formatQuoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

type Handlers = {
  viewerUserId: string | null;
  onOpenDirectLine: (_quote: QuoteView) => void;
  onRespond: (_quote: QuoteView, _amount: number, _currency: string) => Promise<QuoteTransitionResult>;
  onClose: (_quote: QuoteView) => Promise<QuoteTransitionResult>;
};

function QuoteSlots({ quote: q, viewerUserId, onRespond, onClose }: { quote: QuoteView } & Omit<Handlers, 'onOpenDirectLine'>) {
  const { t } = useFDTheme();
  const isProvider = Boolean(viewerUserId) && q.providerUserId === viewerUserId;
  const canRespond = isProvider && q.lifecycleState === 'requested';
  const canClose = q.lifecycleState === 'provider_responded' && q.quotedAmount !== null;
  return (
    <>
      {canClose ? (
        <View style={styles.indent}>
          <QuoteCloseForm quote={q} onClose={onClose} />
        </View>
      ) : null}
      {!isProvider && q.lifecycleState === 'closed' ? (
        <View style={styles.indent}>
          <MarkRecurringControl counterpartyUserId={q.providerUserId} sectorLabel={`ongoing ${q.serviceType} work`} accent={t.ACCENT} />
        </View>
      ) : null}
      {canRespond ? (
        <View style={styles.indent}>
          <QuoteRespondForm onRespond={(amount, currency) => onRespond(q, amount, currency)} />
        </View>
      ) : null}
    </>
  );
}

function QuotedPrice({ quote: q }: { quote: QuoteView }) {
  const { t } = useFDTheme();
  if (q.quotedAmount === null || !q.quotedCurrency) return null;
  return (
    <View style={[styles.indent, styles.price]}>
      <Text style={[font(13, '700'), { color: t.TITLE }]}>Quoted {formatQuotedPrice(q.quotedAmount, q.quotedCurrency)}</Text>
      {q.settledAtIso ? (
        <View style={styles.settled}>
          <CheckCircle2 size={14} color="#22C55E" />
          <Text style={[font(12, '600'), { color: '#22C55E' }]}>Settled</Text>
        </View>
      ) : null}
    </View>
  );
}

function QuoteCard({ quote: q, onOpenDirectLine, ...handlers }: { quote: QuoteView } & Handlers) {
  const { t, r } = useFDTheme();
  const status = QUOTE_STATUS[q.lifecycleState] ?? QUOTE_STATUS.requested;
  return (
    <View style={[styles.card, { borderRadius: r(14), borderColor: alpha(t.ACCENT, '20') }]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { borderRadius: r(12), backgroundColor: alpha(t.ACCENT, '15') }]}>
          <FileText size={18} color={t.ACCENT} />
        </View>
        <View style={styles.flex}>
          <Text style={[font(14, '700'), styles.mb2, { color: t.TITLE }]}>{q.serviceType}</Text>
          <Text style={[font(12), { color: t.MUTED }]}>Requested {formatQuoteDate(q.createdAtIso)}</Text>
        </View>
        <View style={{ backgroundColor: status.bg, borderColor: status.bd, borderWidth: 1 }}>
          <Text style={[font(11), { color: status.fg }]}>{status.label}</Text>
        </View>
        <FDButton label="Direct Line" icon={MessageSquare} iconSize={14} look={{ bg: alpha(t.ACCENT, '15'), border: alpha(t.ACCENT, '30'), color: t.ACCENT }} weight="600" pad={[7, 14]} radius={8} size={12} onPress={() => onOpenDirectLine(q)} />
      </View>
      <QuotedPrice quote={q} />
      <QuoteSlots quote={q} {...handlers} />
    </View>
  );
}

function EmptyQuotes({ onBrowse }: { onBrowse: () => void }) {
  const { t, r } = useFDTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { borderRadius: r(18) }]}>
        <FileText size={28} color={t.ACCENT} style={styles.half} />
      </View>
      <View style={styles.emptyText}>
        <Text style={[font(18, '700'), styles.center, styles.mb8, { color: t.TITLE }]}>No quote requests yet</Text>
        <Text style={[font(14), styles.center, styles.lh24, { color: t.MUTED }]}>
          When you request quotes from trade providers, they&apos;ll appear here so you can track status and manage your service history in one place.
        </Text>
      </View>
      <View style={styles.steps}>
        {EMPTY_STEPS.map((step, i) => (
          <View key={step} style={[styles.step, { borderRadius: r(10) }]}>
            <View style={[styles.stepNumber, { borderRadius: r(11), backgroundColor: alpha(t.ACCENT, '15'), borderColor: alpha(t.ACCENT, '30') }]}>
              <Text style={[font(11, '700'), { color: t.ACCENT }]}>{i + 1}</Text>
            </View>
            <Text style={[font(13), styles.flex, { color: t.MUTED }]}>{step}</Text>
          </View>
        ))}
      </View>
      <FDButton label="Request a Trade Service" icon={Wrench} look={{ bg: t.ACCENT, color: '#fff' }} pad={[12, 24]} radius={12} size={14} style={styles.centerSelf} onPress={onBrowse} />
    </View>
  );
}

export function QuotesPanel({ quotes, onBrowse, ...handlers }: { quotes: QuoteView[]; onBrowse: () => void } & Handlers) {
  const { t } = useFDTheme();
  return (
    <View>
      <Text style={[font(20, '800'), styles.mb4, { color: t.TITLE }]}>My Quote Requests</Text>
      <Text style={[font(14), styles.mb20, { color: t.MUTED }]}>Track your service requests and responses</Text>
      {quotes.length === 0 ? (
        <EmptyQuotes onBrowse={onBrowse} />
      ) : (
        <View style={styles.list}>
          {quotes.map((q) => <QuoteCard key={q.id} quote={q} {...handlers} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  centerSelf: { alignSelf: 'center' },
  half: { opacity: 0.5 },
  mb2: { marginBottom: 2 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb20: { marginBottom: 20 },
  lh24: { lineHeight: 24 },
  list: { gap: 12 },
  card: { paddingVertical: 18, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, gap: 12 },
  cardHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cardIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  indent: { paddingLeft: 54 },
  price: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  settled: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 16 },
  emptyIcon: { width: 64, height: 64, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' },
  emptyText: { maxWidth: 360 },
  steps: { gap: 10, alignSelf: 'stretch', maxWidth: 400 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(239,68,68,0.15)' },
  stepNumber: { width: 22, height: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
