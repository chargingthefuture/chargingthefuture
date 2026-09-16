'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Users } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import type { DirectoryInviteKind, DirectoryInviteQueueRow } from 'lib/directory/invite-queue';

const KIND_LABEL: Record<DirectoryInviteKind, string> = {
  'skill-specific': 'Write about the skill',
  'advocacy-only': 'General invitation',
  'no-skill': 'Nothing recorded yet',
};

// Plain text, because the whole point of this screen is handing the list to somebody who is on a
// phone. One control puts every row on the clipboard in a shape that can be pasted into a message
// and read without a spreadsheet.
function asPlainText(rows: DirectoryInviteQueueRow[]): string {
  return rows
    .map((row) => {
      const parts = [
        `${row.name ?? '(no name)'} — ${row.quoraUrl}`,
        `  kind: ${row.inviteKind}`,
        row.location ? `  where: ${row.location}` : null,
        row.sector ? `  sector: ${row.sector}${row.jobTitle ? ` / ${row.jobTitle}` : ''}` : null,
        row.skills.length > 0 ? `  skills: ${row.skills.join('; ')}` : null,
        row.pendingSkills.length > 0 ? `  pending: ${row.pendingSkills.join('; ')}` : null,
        row.headline ? `  headline: ${row.headline}` : null,
        row.bio ? `  about: ${row.bio}` : null,
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');
}

export function DirectoryInviteQueueShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('directory', theme), theme);

  const [rows, setRows] = useState<DirectoryInviteQueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/directory/admin/invite-queue');
        const payload = (await response.json()) as { rows?: DirectoryInviteQueueRow[]; message?: string };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setError(payload.message ?? `The queue did not load (${response.status}).`);
          return;
        }
        setRows(payload.rows ?? []);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'The queue did not load.');
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const tally = { 'skill-specific': 0, 'advocacy-only': 0, 'no-skill': 0 } as Record<DirectoryInviteKind, number>;
    for (const row of rows ?? []) {
      tally[row.inviteKind] += 1;
    }
    return tally;
  }, [rows]);

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
  }, [rows]);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Invite queue" accent={t.ACCENT} icon={<Users size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 14px', lineHeight: 1.5 }}>
          Everybody listed in the Directory who does not already have an invite post, with what they
          can do. Your own listing and the people already written about are left out.
        </p>

        {error && (
          <p role="alert" style={{ fontSize: 13, color: '#F87171', margin: '0 0 14px' }}>
            {error}
          </p>
        )}

        {!rows && !error && <p style={{ fontSize: 13, color: t.SUBTLE }}>Loading the queue…</p>}

        {rows && rows.length === 0 && (
          <p style={{ fontSize: 13, color: t.SUBTLE }}>
            Nobody is waiting. Every listed person with a Quora address already has a post.
          </p>
        )}

        {rows && rows.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 12 }}>
              {rows.length} waiting · {counts['skill-specific']} with a skill to write about ·{' '}
              {counts['advocacy-only']} general · {counts['no-skill']} with nothing recorded
            </div>

            <button
              type="button"
              onClick={() => void onCopy()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: t.ACCENT,
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
              {copied ? 'Copied' : 'Copy the whole queue'}
            </button>

            {rows.map((row) => (
              <article
                key={row.profileId}
                style={{
                  borderRadius: 14,
                  background: t.SURFACE,
                  border: `1px solid ${t.BORDER}`,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>{row.name ?? '(no name)'}</div>
                <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 3, wordBreak: 'break-all' }}>{row.quoraUrl}</div>
                <div style={{ fontSize: 12, color: t.ACCENT, marginTop: 6 }}>{KIND_LABEL[row.inviteKind]}</div>
                {row.location && (
                  <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 6 }}>{row.location}</div>
                )}
                {row.skills.length > 0 && (
                  <div style={{ fontSize: 12, color: t.TEXT, marginTop: 8, lineHeight: 1.5 }}>
                    {row.skills.join(' · ')}
                  </div>
                )}
                {row.pendingSkills.length > 0 && (
                  <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 6, lineHeight: 1.5 }}>
                    Pending review: {row.pendingSkills.join(' · ')}
                  </div>
                )}
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
