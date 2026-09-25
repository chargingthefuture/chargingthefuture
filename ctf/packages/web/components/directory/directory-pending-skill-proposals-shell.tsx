'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Tags } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import type {
  DirectoryPendingSkillProposalRow,
  DirectoryPendingSkillSource,
} from 'lib/directory/pending-skill-proposals';

type Filter = 'all' | DirectoryPendingSkillSource;
type Row = DirectoryPendingSkillProposalRow;
type Tokens = ReturnType<typeof getPluginShellTokens>;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'skills-hunt', label: 'From a nomination' },
  { key: 'directory', label: 'Added by the member' },
];

const SOURCE_LABEL: Record<DirectoryPendingSkillSource, string> = {
  'skills-hunt': 'Proposed on a SkillsHunt nomination',
  directory: 'Added by the member through "skill not listed"',
};

function rowKey(row: Row): string {
  return `${row.profileId}|${row.source}|${row.skillLabel.toLowerCase()}`;
}

function displayName(row: Row): string {
  return row.name ?? row.handle ?? '(no name)';
}

function issueText(row: Row): string | null {
  if (!row.issueNumber) {
    return null;
  }
  const status = row.trackerStatus ? ` (${row.trackerStatus})` : '';
  return `  issue: #${row.issueNumber}${status}`;
}

// Plain text, for the same reason the invite queue has it: the owner reads this on a phone and
// pastes it into a message when deciding what to promote.
function asPlainText(rows: Row[]): string {
  return rows
    .map((row) => {
      const parts = [
        `${displayName(row)} — ${row.skillLabel}`,
        `  from: ${SOURCE_LABEL[row.source]}`,
        issueText(row),
        row.inTaxonomy ? '  note: already a taxonomy skill under this name' : null,
        row.heldSkills.length > 0 ? `  holds: ${row.heldSkills.join('; ')}` : '  holds: nothing yet',
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');
}

async function postDrop(row: Row): Promise<string | null> {
  const response = await fetch('/api/directory/admin/pending-skill-proposals/drop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ profileId: row.profileId, skillLabel: row.skillLabel, source: row.source }),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    return payload.message ?? `The drop did not go through (${response.status}).`;
  }
  return null;
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: '1px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

function PersonLine({ row, tokens }: { row: Row; tokens: Tokens }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: tokens.TITLE }}>{displayName(row)}</span>
        {!row.claimed && <Badge text="Unclaimed" color={tokens.SUBTLE} />}
        {!row.active && <Badge text="Inactive profile" color="#F59E0B" />}
      </div>
      {row.handle && <div style={{ fontSize: 12, color: tokens.SUBTLE, marginTop: 3 }}>@{row.handle}</div>}
    </>
  );
}

function ProposalLine({ row, tokens }: { row: Row; tokens: Tokens }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: tokens.ACCENT }}>{row.skillLabel}</span>
        {row.inTaxonomy && <Badge text="Already a taxonomy skill" color="#34D399" />}
      </div>
      <div style={{ fontSize: 12, color: tokens.SUBTLE, marginTop: 4 }}>{SOURCE_LABEL[row.source]}</div>
    </>
  );
}

function IssueLine({ row, tokens }: { row: Row; tokens: Tokens }) {
  if (!row.issueNumber) {
    return null;
  }
  const label = `Issue #${row.issueNumber}`;
  return (
    <div style={{ fontSize: 12, marginTop: 4 }}>
      {row.issueUrl ? (
        <a href={row.issueUrl} target="_blank" rel="noreferrer" style={{ color: tokens.ACCENT }}>
          {label}
        </a>
      ) : (
        <span style={{ color: tokens.TEXT }}>{label}</span>
      )}
      {row.trackerStatus && <span style={{ color: tokens.SUBTLE }}> · {row.trackerStatus}</span>}
    </div>
  );
}

function HeldLine({ row, tokens }: { row: Row; tokens: Tokens }) {
  const text = row.heldSkills.length > 0 ? `Holds: ${row.heldSkills.join(' · ')}` : 'Holds nothing from the taxonomy yet';
  return <div style={{ fontSize: 12, color: tokens.TEXT, marginTop: 8, lineHeight: 1.5 }}>{text}</div>;
}

function dropLabel(armed: boolean, busy: boolean): string {
  if (busy) {
    return 'Dropping…';
  }
  return armed ? 'Press again to drop this chip' : 'Drop';
}

function DropButton({ armed, busy, onPress }: { armed: boolean; busy: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={busy}
      style={{
        marginTop: 12,
        background: armed ? '#EF4444' : 'transparent',
        color: armed ? '#0B0B0F' : '#F87171',
        border: '1px solid rgba(239,68,68,0.5)',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 700,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {dropLabel(armed, busy)}
    </button>
  );
}

function KeepButton({ tokens, onPress }: { tokens: Tokens; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        marginTop: 12,
        marginLeft: 8,
        background: 'transparent',
        color: tokens.SUBTLE,
        border: `1px solid ${tokens.BORDER}`,
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      Keep it
    </button>
  );
}

// Drop asks twice on purpose: the first press arms the control and the second sends it, so a thumb
// on a phone cannot clear a chip by brushing past it.
function useDropProposal(row: Row, onDropped: (row: Row) => void) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = useCallback(async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const failure = await postDrop(row);
      if (failure) {
        setError(failure);
        setArmed(false);
        return;
      }
      onDropped(row);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The drop did not go through.');
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }, [armed, onDropped, row]);

  const keep = useCallback(() => setArmed(false), []);

  return { armed, busy, error, press, keep };
}

function ProposalCard({ row, tokens, onDropped }: { row: Row; tokens: Tokens; onDropped: (row: Row) => void }) {
  const drop = useDropProposal(row, onDropped);

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
      <PersonLine row={row} tokens={tokens} />
      <ProposalLine row={row} tokens={tokens} />
      <IssueLine row={row} tokens={tokens} />
      <HeldLine row={row} tokens={tokens} />
      {drop.error && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '8px 0 0' }}>
          {drop.error}
        </p>
      )}
      <DropButton armed={drop.armed} busy={drop.busy} onPress={() => void drop.press()} />
      {drop.armed && !drop.busy && <KeepButton tokens={tokens} onPress={drop.keep} />}
    </article>
  );
}

function FilterChips({ filter, onChange, tokens }: { filter: Filter; onChange: (next: Filter) => void; tokens: Tokens }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {FILTERS.map((entry) => {
        const active = filter === entry.key;
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => onChange(entry.key)}
            style={{
              flex: 1,
              padding: 7,
              borderRadius: 8,
              background: active ? `${tokens.ACCENT}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? `${tokens.ACCENT}40` : tokens.BORDER}`,
              color: active ? tokens.ACCENT : tokens.SUBTLE,
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

type Counts = { nominated: number; selfAdded: number; people: number };

function countRows(rows: Row[]): Counts {
  const people = new Set<string>();
  let nominated = 0;
  let selfAdded = 0;
  for (const row of rows) {
    people.add(row.profileId);
    if (row.source === 'skills-hunt') {
      nominated += 1;
    } else {
      selfAdded += 1;
    }
  }
  return { nominated, selfAdded, people: people.size };
}

function CountsLine({ total, counts, tokens }: { total: number; counts: Counts; tokens: Tokens }) {
  const noun = counts.people === 1 ? 'profile' : 'profiles';
  return (
    <div style={{ fontSize: 12, color: tokens.SUBTLE, marginBottom: 12 }}>
      {total} pending on {counts.people} {noun} · {counts.nominated} from nominations · {counts.selfAdded} added by
      members
    </div>
  );
}

// The loading, failed and empty states, kept out of the shell so it stays under the complexity
// limit. Renders nothing once there are rows to show.
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
    return <p style={{ fontSize: 13, color: tokens.SUBTLE }}>No profile carries a pending skill chip.</p>;
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

function usePendingProposals() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const response = await fetch('/api/directory/admin/pending-skill-proposals');
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

  const removeRow = useCallback((dropped: Row) => {
    setRows((current) => (current ?? []).filter((row) => rowKey(row) !== rowKey(dropped)));
  }, []);

  return { rows, error, setError, removeRow };
}

export function DirectoryPendingSkillProposalsShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('directory', theme), theme);
  const { rows, error, setError, removeRow } = usePendingProposals();
  const [filter, setFilter] = useState<Filter>('all');
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => (rows ?? []).filter((row) => filter === 'all' || row.source === filter), [rows, filter]);
  const counts = useMemo(() => countRows(rows ?? []), [rows]);
  const hasRows = Boolean(rows && rows.length > 0);

  const onCopy = useCallback(async () => {
    if (visible.length === 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(asPlainText(visible));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  }, [visible, setError]);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Pending skill proposals" accent={t.ACCENT} icon={<Tags size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 14px', lineHeight: 1.5 }}>
          Every free-text skill still sitting on a profile as a "pending review" chip, with what that
          person already holds. Promotion happens through the change list; this is where a chip is
          dropped once its proposal is closed without one.
        </p>

        <ListStatus rows={rows} error={error} tokens={t} />

        {hasRows && (
          <>
            <CountsLine total={rows?.length ?? 0} counts={counts} tokens={t} />
            <FilterChips filter={filter} onChange={setFilter} tokens={t} />
            <CopyButton copied={copied} onPress={() => void onCopy()} tokens={t} />
            {visible.length === 0 && <p style={{ fontSize: 13, color: t.SUBTLE }}>Nothing under this filter.</p>}
            {visible.map((row) => (
              <ProposalCard key={rowKey(row)} row={row} tokens={t} onDropped={removeRow} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
