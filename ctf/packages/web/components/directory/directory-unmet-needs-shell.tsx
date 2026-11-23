'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCopy, SearchX } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import type { DirectoryUnmetNeedRow } from 'lib/directory/unmet-needs';

type Row = DirectoryUnmetNeedRow;
type Tokens = ReturnType<typeof getPluginShellTokens>;

// The landing page records a single added skill as `skill:<job title>`; every other row is the
// label of a need from its list.
const SKILL_PREFIX = 'skill:';

function needLabel(need: string): { label: string; singleSkill: boolean } {
  if (need.startsWith(SKILL_PREFIX)) {
    return { label: need.slice(SKILL_PREFIX.length).trim() || need, singleSkill: true };
  }
  return { label: need, singleSkill: false };
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function timesText(count: number): string {
  return count === 1 ? 'asked once' : `asked ${count} times`;
}

// Plain text, so the list can be pasted into a message from a phone.
function asPlainText(rows: Row[]): string {
  return rows
    .map((row) => {
      const { label, singleSkill } = needLabel(row.need);
      const kind = singleSkill ? ' (single skill)' : '';
      return `${label}${kind} — ${timesText(row.timesAsked)}, first ${day(row.firstAsked)}, last ${day(row.lastAsked)}`;
    })
    .join('\n');
}

function NeedCard({ row, tokens }: { row: Row; tokens: Tokens }) {
  const { label, singleSkill } = needLabel(row.need);
  return (
    <article
      style={{
        borderRadius: 14,
        background: tokens.SURFACE,
        border: `1px solid ${tokens.BORDER}`,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: tokens.TITLE, flex: 1, minWidth: 0 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: tokens.ACCENT, whiteSpace: 'nowrap' }}>
          {row.timesAsked}×
        </span>
      </div>
      {singleSkill && <div style={{ fontSize: 11, color: tokens.SUBTLE, marginTop: 3 }}>Single skill</div>}
      <div style={{ fontSize: 12, color: tokens.SUBTLE, marginTop: 6 }}>
        First asked {day(row.firstAsked)} · last asked {day(row.lastAsked)}
      </div>
    </article>
  );
}

function ListStatus({ rows, error, tokens }: { rows: Row[] | null; error: string | null; tokens: Tokens }) {
  if (error) {
    return (
      <p role="alert" style={{ fontSize: 13, color: '#F87171', margin: '0 0 14px' }}>
        {error}
      </p>
    );
  }
  if (!rows) {
    return <p style={{ fontSize: 13, color: tokens.SUBTLE }}>Loading the list…</p>;
  }
  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: tokens.SUBTLE }}>No unmet need has been recorded yet.</p>;
  }
  return null;
}

function CopyButton({ copied, onPress, tokens }: { copied: boolean; onPress: () => void; tokens: Tokens }) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: tokens.ACCENT,
        color: '#0B0B0F',
        border: 'none',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        marginBottom: 18,
      }}
    >
      <ClipboardCopy size={15} />
      {copied ? 'Copied' : 'Copy this list'}
    </button>
  );
}

function useUnmetNeeds() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const response = await fetch('/api/directory/admin/unmet-needs');
        const payload = (await response.json()) as { rows?: Row[]; message?: string };
        if (canceled) {
          return;
        }
        if (!response.ok) {
          setError(payload.message ?? `The list did not load (${response.status}).`);
          return;
        }
        setRows(payload.rows ?? []);
      } catch (caught) {
        if (!canceled) {
          setError(caught instanceof Error ? caught.message : 'The list did not load.');
        }
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, []);

  return { rows, error, setError };
}

export function DirectoryUnmetNeedsShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('directory', theme), theme);
  const { rows, error, setError } = useUnmetNeeds();
  const [copied, setCopied] = useState(false);
  const hasRows = Boolean(rows && rows.length > 0);
  const visits = (rows ?? []).reduce((sum, row) => sum + row.timesAsked, 0);

  const onCopy = useCallback(async () => {
    if (!rows || rows.length === 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(asPlainText(rows));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  }, [rows, setError]);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Unmet needs" accent={t.ACCENT} icon={<SearchX size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 14px', lineHeight: 1.5 }}>
          Needs that landing page visitors picked when nobody in the Directory matched them, most asked
          first. A need that has people now still shows here with its history; the last asked date
          says how recent the demand is.
        </p>

        <ListStatus rows={rows} error={error} tokens={t} />

        {hasRows && (
          <>
            <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 12 }}>
              {rows?.length} {rows?.length === 1 ? 'need' : 'needs'} · {visits} {visits === 1 ? 'visit' : 'visits'}
            </div>
            <CopyButton copied={copied} onPress={() => void onCopy()} tokens={t} />
            {rows?.map((row) => (
              <NeedCard key={row.need} row={row} tokens={t} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
