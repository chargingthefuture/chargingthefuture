'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import {
  billingLabel,
  formatDollarRange,
  formatDollars,
  formatShare,
  type Expense,
  type ExpenseSummary,
} from 'lib/admin-expenses/summary';

type Actions = {
  busyId: string | null;
  onEdit: (expense: Expense) => void;
  onCheckedToday: (expense: Expense) => void;
  onRemove: (expense: Expense) => void;
};

function Stat({ tokens: t, label, value, detail }: { tokens: PluginShellTokens; label: string; value: string; detail?: string }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 0, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: t.TITLE, overflowWrap: 'anywhere' }}>{value}</div>
      {detail ? <div style={{ fontSize: 11, color: t.SUBTLE, marginTop: 2 }}>{detail}</div> : null}
    </div>
  );
}

function Section({ tokens: t, title, children }: { tokens: PluginShellTokens; title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: t.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

function Tag({ tokens: t, children, color }: { tokens: PluginShellTokens; children: ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: color ?? t.SUBTLE, border: `1px solid ${color ?? t.BORDER_SOLID}`, borderRadius: 4, padding: '1px 6px' }}>
      {children}
    </span>
  );
}

function ExpenseCard({ tokens: t, expense, amount, share, actions, marker }: {
  tokens: PluginShellTokens;
  expense: Expense;
  amount: string;
  share?: number | null;
  actions: Actions;
  marker?: ReactNode;
}) {
  const busy = actions.busyId === expense.id;
  const button: CSSProperties = { padding: '5px 10px', borderRadius: 7, border: `1px solid ${t.BORDER_SOLID}`, background: 'transparent', color: t.SUBTLE, fontSize: 12, opacity: busy ? 0.5 : 1 };
  return (
    <div style={{ padding: 12, borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{expense.provider}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, whiteSpace: 'nowrap' }}>{amount}</span>
        {share !== undefined ? <span style={{ fontSize: 12, color: t.ACCENT, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{formatShare(share)}</span> : null}
      </div>
      {share !== undefined && share !== null ? (
        <div aria-hidden style={{ height: 4, borderRadius: 2, background: t.INPUT_BG, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, share * 100)}%`, height: '100%', background: t.ACCENT }} />
        </div>
      ) : null}
      {expense.purpose ? <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 6 }}>{expense.purpose}</div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 }}>
        {marker}
        {expense.kind === 'recurring' ? <Tag tokens={t}>{billingLabel(expense.billing)}</Tag> : null}
        <span style={{ fontSize: 11, color: expense.lastCheckedOn ? t.MUTED : '#F59E0B' }}>
          {expense.lastCheckedOn ? `Checked ${expense.lastCheckedOn}` : 'Never checked'}
        </span>
      </div>
      {expense.notes ? <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6, whiteSpace: 'pre-wrap' }}>{expense.notes}</div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <button type="button" disabled={busy} style={button} onClick={() => actions.onEdit(expense)}>Edit</button>
        <button type="button" disabled={busy} style={button} onClick={() => actions.onCheckedToday(expense)}>Checked today</button>
        <button type="button" disabled={busy} style={{ ...button, color: '#EF4444' }} onClick={() => actions.onRemove(expense)}>Remove</button>
      </div>
    </div>
  );
}

function Empty({ tokens: t, children }: { tokens: PluginShellTokens; children: ReactNode }) {
  return <div style={{ padding: 12, borderRadius: 10, border: `1px dashed ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13 }}>{children}</div>;
}

// The costs: the three numbers the decision turns on at the top, then every line, largest first,
// with its share of the month. Unpriced, stopped and one-off lines sit in their own groups so none
// of them bends the monthly figure.
export function ExpensesOverview({ tokens: t, summary, actions }: { tokens: PluginShellTokens; summary: ExpenseSummary; actions: Actions }) {
  const perMember =
    summary.perMemberLowCents !== null && summary.perMemberHighCents !== null
      ? formatDollarRange(summary.perMemberLowCents, summary.perMemberHighCents)
      : '—';
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <Stat
          tokens={t}
          label="Monthly total"
          value={formatDollarRange(summary.monthlyLowCents, summary.monthlyHighCents)}
          detail={summary.unpriced.length > 0 ? `${summary.unpriced.length} more not priced yet` : 'Every live line is priced'}
        />
        <Stat
          tokens={t}
          label="Per approved member, monthly"
          value={perMember}
          detail={summary.approvedMembers > 0 ? `${summary.approvedMembers} approved members` : 'No approved members yet'}
        />
        <Stat tokens={t} label="One-off, last 12 months" value={formatDollars(summary.oneOffLastYearCents)} detail="Not in the monthly total" />
      </div>

      <Section tokens={t} title="Recurring, largest first">
        {summary.priced.length === 0 ? <Empty tokens={t}>No recurring cost has an amount yet.</Empty> : null}
        {summary.priced.map((line) => (
          <ExpenseCard key={line.expense.id} tokens={t} expense={line.expense} amount={formatDollarRange(line.lowCents, line.highCents)} share={line.share} actions={actions} />
        ))}
        {summary.priced.some((line) => line.highCents > line.lowCents) ? (
          <div style={{ fontSize: 11, color: t.MUTED }}>Shares use the middle of any range.</div>
        ) : null}
      </Section>

      {summary.unpriced.length > 0 ? (
        <Section tokens={t} title="Not priced yet — not in the total">
          {summary.unpriced.map((expense) => (
            <ExpenseCard key={expense.id} tokens={t} expense={expense} amount="—" actions={actions} marker={<Tag tokens={t} color="#F59E0B">No amount</Tag>} />
          ))}
        </Section>
      ) : null}

      {summary.stopped.length > 0 ? (
        <Section tokens={t} title="Stopped">
          {summary.stopped.map((expense) => (
            <ExpenseCard
              key={expense.id}
              tokens={t}
              expense={expense}
              amount={expense.amountCents === null ? '—' : formatDollarRange(expense.amountCents, expense.amountMaxCents ?? expense.amountCents)}
              actions={actions}
              marker={<Tag tokens={t} color="#9CA3AF">Stopped {expense.stoppedOn}</Tag>}
            />
          ))}
        </Section>
      ) : null}

      <Section tokens={t} title="One-off payments">
        {summary.oneOff.length === 0 ? <Empty tokens={t}>No one-off payments recorded.</Empty> : null}
        {summary.oneOff.map((expense) => (
          <ExpenseCard
            key={expense.id}
            tokens={t}
            expense={expense}
            amount={expense.amountCents === null ? '—' : formatDollars(expense.amountCents)}
            actions={actions}
            marker={<Tag tokens={t}>{expense.paidOn ? `Paid ${expense.paidOn}` : 'No date'}</Tag>}
          />
        ))}
      </Section>
    </>
  );
}
