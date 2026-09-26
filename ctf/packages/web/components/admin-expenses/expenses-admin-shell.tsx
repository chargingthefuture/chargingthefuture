'use client';

// /admin/expenses: what Skills Economy costs to run each month. The owner pays every bill personally
// and decides what to cut from here, on a phone, so the screen puts the monthly total, each line's
// share of it, and the cost per approved member first, and can copy all of it as plain text.
// These are real dollar amounts a person pays; the rule against money language covers in-app
// credits only.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Plus, Receipt } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { expensesAsPlainText, summarizeExpenses, type Expense } from 'lib/admin-expenses/summary';
import type { ExpenseInput } from 'lib/admin-expenses/parse';
import { EXPENSES_ACCENT, localToday, mutateExpense, toInput } from './expenses-shared';
import { ExpenseForm } from './expense-form';
import { ExpensesOverview } from './expenses-overview';
import { ExpensesAudit } from './expenses-audit';

type Tab = 'costs' | 'audit';
const TABS: { key: Tab; label: string }[] = [
  { key: 'costs', label: 'Costs' },
  { key: 'audit', label: 'Audit log' },
];

// null = closed, 'new' = adding, an Expense = editing that one.
type Editing = null | 'new' | Expense;

type Tokens = ReturnType<typeof getPluginShellTokens>;

function TabBar({ tokens: t, tab, onChange }: { tokens: Tokens; tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div role="tablist" aria-label="Expenses sections" style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {TABS.map((entry) => {
        const active = tab === entry.key;
        return (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(entry.key)}
            style={{
              padding: '7px 16px',
              borderRadius: 20,
              border: `1px solid ${active ? t.ACCENT : t.BORDER_SOLID}`,
              background: active ? `${t.ACCENT}25` : t.INPUT_BG,
              color: active ? t.TITLE : t.SUBTLE,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

function Toolbar({ tokens: t, copied, canAdd, onCopy, onAdd }: { tokens: Tokens; copied: boolean; canAdd: boolean; onCopy: () => void; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      <button
        type="button"
        onClick={onCopy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: 'none', background: t.ACCENT, color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}
      >
        <ClipboardCopy size={15} />
        {copied ? 'Copied' : 'Copy as text'}
      </button>
      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${t.BORDER_SOLID}`, background: t.INPUT_BG, color: t.TITLE, fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={15} />
          Add a cost
        </button>
      ) : null}
    </div>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
      {error}
    </div>
  );
}

function Loading({ tokens: t }: { tokens: Tokens }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>Loading…</div>
  );
}

// A live recurring cost is usually canceled, not mistaken, so the confirm points at the stop date.
function removeMessage(expense: Expense): string {
  if (expense.kind !== 'recurring' || expense.stoppedOn) return `Remove ${expense.provider}?`;
  return `Remove ${expense.provider}? Use this for a line entered by mistake. If you canceled it, edit it and set a stop date instead, so the cut stays on the record.`;
}

// Where Save sends the form: a new line, or the line being edited.
function saveRequest(editing: Exclude<Editing, null>, input: ExpenseInput): { id: string; send: () => ReturnType<typeof mutateExpense> } {
  if (editing === 'new') return { id: 'new', send: () => mutateExpense('/api/admin/expenses', 'POST', input) };
  return { id: editing.id, send: () => mutateExpense(`/api/admin/expenses/${editing.id}`, 'PATCH', input) };
}

export function ExpensesAdminShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(EXPENSES_ACCENT, theme);
  const [tab, setTab] = useState<Tab>('costs');
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [approvedMembers, setApprovedMembers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/expenses');
      if (!res.ok) {
        setError(await responseFailureText(res, 'The costs could not be loaded.'));
        return;
      }
      const data = (await res.json()) as { expenses?: Expense[]; approvedMembers?: number };
      setExpenses(data.expenses ?? []);
      setApprovedMembers(data.approvedMembers ?? 0);
    } catch (caught) {
      setError(failureText(caught, { area: 'admin-expenses', op: 'load', fallback: 'The costs could not be loaded.' }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = localToday();
  const summary = useMemo(() => (expenses ? summarizeExpenses(expenses, approvedMembers, today) : null), [expenses, approvedMembers, today]);

  async function run(id: string, action: () => ReturnType<typeof mutateExpense>): Promise<boolean> {
    setBusyId(id);
    setError(null);
    const result = await action();
    if (!result.ok) setError(result.message);
    else await load();
    setBusyId(null);
    return result.ok;
  }

  async function save(input: ExpenseInput) {
    if (editing === null) return;
    const request = saveRequest(editing, input);
    if (await run(request.id, request.send)) setEditing(null);
  }

  function checkedToday(expense: Expense) {
    void run(expense.id, () => mutateExpense(`/api/admin/expenses/${expense.id}`, 'PATCH', { ...toInput(expense), lastCheckedOn: today }));
  }

  function remove(expense: Expense) {
    const message = removeMessage(expense);
    if (!window.confirm(message)) return;
    void run(expense.id, () => mutateExpense(`/api/admin/expenses/${expense.id}`, 'DELETE'));
  }

  async function copy() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(expensesAsPlainText(summary, today));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(failureText(caught, { area: 'admin-expenses', op: 'copy', fallback: 'Copy failed.' }));
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <MobileScreenHeader title="Expenses" accent={t.ACCENT} icon={<Receipt size={18} color={t.ACCENT} />} />
      {/* No in-page title card: the header above names the screen (rule 131, owner report 2026-07-27). */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 16px 48px' }}>
        <TabBar tokens={t} tab={tab} onChange={setTab} />

        <ErrorBanner error={error} />

        {tab === 'audit' ? <ExpensesAudit tokens={t} /> : null}

        {tab === 'costs' && !summary && !error ? <Loading tokens={t} /> : null}

        {tab === 'costs' && summary ? (
          <>
            <Toolbar tokens={t} copied={copied} canAdd={editing === null} onCopy={() => void copy()} onAdd={() => setEditing('new')} />

            {editing !== null ? (
              <ExpenseForm
                key={editing === 'new' ? 'new' : editing.id}
                tokens={t}
                initial={editing === 'new' ? null : toInput(editing)}
                busy={busyId !== null}
                onSave={(input) => void save(input)}
                onCancel={() => setEditing(null)}
              />
            ) : null}

            <ExpensesOverview
              tokens={t}
              summary={summary}
              actions={{
                busyId,
                onEdit: (expense) => {
                  setEditing(expense);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                },
                onCheckedToday: checkedToday,
                onRemove: remove,
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
