'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Users } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import type { DirectoryInviteKind, DirectoryInviteQueueRow } from 'lib/directory/invite-queue';
import type { DirectorySkillCoverage } from 'lib/directory/skill-coverage';

const KIND_LABEL: Record<DirectoryInviteKind, string> = {
  'skill-specific': 'Write about the skill',
  'advocacy-only': 'General invitation',
  'no-skill': 'Nothing recorded yet',
};

// Plain text, because this screen exists to hand the list to somebody who is on a phone. One
// control puts everything on the clipboard in a shape that can be pasted into a message and read
// without a spreadsheet.
//
// The coverage figures go first and deliberately so. The invite posts argue from them, and a paste
// that carries the people without the numbers means the numbers get copied forward from an older
// reading instead.
function coverageAsPlainText(coverage: DirectorySkillCoverage): string {
  const readAt = coverage.readAt.slice(0, 10);
  const lines = [
    `Skills coverage — read ${readAt} (UTC)`,
    `  listed people: ${coverage.listedPeople}`,
    `  skills in the catalog: ${coverage.skillsInCatalog}`,
    `  skills somebody holds: ${coverage.skillsHeld}`,
    `  skills with nobody: ${coverage.skillsWithNobody}`,
    '',
    '  by sector (held of in catalog):',
    ...coverage.sectors.map(
      (sector) => `    ${sector.sector}: ${sector.skillsHeld} of ${sector.skillsInCatalog}`,
    ),
  ];
  return lines.join('\n');
}

function asPlainText(rows: DirectoryInviteQueueRow[], coverage: DirectorySkillCoverage | null): string {
  const queue = rows
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

  return coverage ? `${coverageAsPlainText(coverage)}\n\n${queue}` : queue;
}

type CoverageTokens = {
  SURFACE: string;
  BORDER: string;
  TITLE: string;
  SUBTLE: string;
  TEXT: string;
};

// Its own component so the shell stays under the complexity limit, and because this block is a
// different thing from the queue: counts about the catalog rather than rows about people.
function CoverageCard({
  coverage,
  tokens,
}: {
  coverage: DirectorySkillCoverage;
  tokens: CoverageTokens;
}) {
  const people = coverage.listedPeople === 1 ? 'person' : 'people';

  return (
    <section
      aria-label="Skills coverage"
      style={{
        borderRadius: 14,
        background: tokens.SURFACE,
        border: `1px solid ${tokens.BORDER}`,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: tokens.TITLE }}>Skills coverage</div>
      <div style={{ fontSize: 12, color: tokens.SUBTLE, marginTop: 4 }}>
        Read {coverage.readAt.slice(0, 10)} (UTC). Copied with the queue.
      </div>
      <div style={{ fontSize: 12, color: tokens.TEXT, marginTop: 8, lineHeight: 1.6 }}>
        {coverage.listedPeople} listed {people} · {coverage.skillsHeld} of {coverage.skillsInCatalog}{' '}
        skills held · {coverage.skillsWithNobody} with nobody
      </div>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
        {coverage.sectors.map((sector) => (
          <CoverageRow key={sector.sector} sector={sector} tokens={tokens} />
        ))}
      </ul>
    </section>
  );
}

// A sector nobody covers is dimmed rather than hidden. An empty sector is the thing worth seeing.
function CoverageRow({
  sector,
  tokens,
}: {
  sector: DirectorySkillCoverage['sectors'][number];
  tokens: CoverageTokens;
}) {
  return (
    <li
      style={{
        fontSize: 12,
        color: sector.skillsHeld === 0 ? tokens.SUBTLE : tokens.TEXT,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '3px 0',
      }}
    >
      <span>{sector.sector}</span>
      <span style={{ color: tokens.SUBTLE, whiteSpace: 'nowrap' }}>
        {sector.skillsHeld} of {sector.skillsInCatalog}
      </span>
    </li>
  );
}

export function DirectoryInviteQueueShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('directory', theme), theme);

  const [rows, setRows] = useState<DirectoryInviteQueueRow[] | null>(null);
  const [coverage, setCoverage] = useState<DirectorySkillCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const response = await fetch('/api/directory/admin/invite-queue');
        const payload = (await response.json()) as {
          rows?: DirectoryInviteQueueRow[];
          coverage?: DirectorySkillCoverage;
          message?: string;
        };
        if (canceled) {
          return;
        }
        if (!response.ok) {
          setError(payload.message ?? `The queue did not load (${response.status}).`);
          return;
        }
        setRows(payload.rows ?? []);
        setCoverage(payload.coverage ?? null);
      } catch (caught) {
        if (!canceled) {
          setError(caught instanceof Error ? caught.message : 'The queue did not load.');
        }
      }
    }

    void load();
    return () => {
      canceled = true;
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
      await navigator.clipboard.writeText(asPlainText(rows, coverage));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  }, [rows, coverage]);

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

        {coverage && <CoverageCard coverage={coverage} tokens={t} />}

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
