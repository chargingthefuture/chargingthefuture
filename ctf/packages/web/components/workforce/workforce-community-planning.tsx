'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Users } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens, type WorkforceTokens } from './workforce-shared';
import { WorkforceMemberList } from './workforce-member-list';
import type { WorkforceMatchedMember } from '../../lib/workforce/types';

// The Community Planning tab. A read-only overlay that groups Directory members into the planning
// teams: the ten from GitHub issue #1465 (the survivor-built community planning document), plus the
// teams added so the model covers a community that can run without outside services — see
// lib/workforce/community-planning.ts for why. Each team is a
// named union of Workforce sectors; its roster is the de-duplicated members that already match those
// sectors, and its gap is the sectors' summed demand gap. Reads the live model, so it recomputes on
// every load as the Directory changes — no scheduled job, and member names never leave the app.

type CommunityPlanningTeam = {
  key: string;
  name: string;
  responsibleFor: string;
  sectors: string[];
  matchedSectors: string[];
  missingSectors: string[];
  target: number;
  recruited: number;
  gap: number;
  memberCount: number;
  members: WorkforceMatchedMember[];
};

type CommunityPlanningReport = {
  generatedAtIso: string;
  sourceIssue: string;
  teams: CommunityPlanningTeam[];
};

function TeamCard({ team, t }: { team: CommunityPlanningTeam; t: WorkforceTokens }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 6px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {open ? (
          <ChevronDown size={16} style={{ color: t.MUTED, flexShrink: 0, marginTop: 3 }} />
        ) : (
          <ChevronRight size={16} style={{ color: t.MUTED, flexShrink: 0, marginTop: 3 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.TEXT }}>{team.name}</div>
          <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2, lineHeight: 1.5 }}>
            {team.responsibleFor}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {team.sectors.map((s) => {
              const missing = team.missingSectors.includes(s);
              return (
                <span
                  key={s}
                  title={missing ? 'This sector is not currently in the Skills Taxonomy' : undefined}
                  style={{
                    fontSize: 10,
                    color: missing ? '#F59E0B' : t.SUBTLE,
                    background: missing ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${missing ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 6,
                    padding: '1px 6px',
                  }}
                >
                  {s}{missing ? ' · not mapped' : ''}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              fontWeight: 700,
              color: t.ACCENT,
            }}
          >
            <Users size={13} /> {team.memberCount.toLocaleString()}
          </span>
          <span style={{ fontSize: 11, color: t.MUTED }}>
            {team.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>
      </button>

      {open ? (
        <div style={{ padding: '4px 6px 18px 34px' }}>
          {team.memberCount === 0 ? (
            <div style={{ fontSize: 13, color: t.MUTED }}>
              No members match this team&apos;s sectors yet. As members join and set their skills in the
              Directory, they appear here automatically.
            </div>
          ) : (
            <WorkforceMemberList members={team.members} linkProfiles showOccupationGap={false} />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function WorkforceCommunityPlanning() {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const [report, setReport] = useState<CommunityPlanningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch('/api/workforce/reports/community-planning', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed (${res.status}).`);
        }
        const json = (await res.json()) as { report?: CommunityPlanningReport };
        setReport(json.report ?? null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load community planning roster.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.MUTED, fontSize: 13, padding: 24 }}>
        <Loader2 size={16} className="ctf-spin" /> Building team rosters…
      </div>
    );
  }

  if (error) {
    return <div style={{ fontSize: 14, color: '#EF4444', padding: 24 }}>{error}</div>;
  }

  const teams = report?.teams ?? [];

  return (
    <div style={{ flex: 1 }}>
      <div style={{ padding: '24px' }}>
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>
            Community planning teams
          </div>
          <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.7, marginBottom: 4 }}>
            Proposed rosters for the survivor-built community planning document. The teams are scoped
            to a community that has to run without outside services — its own water, power, schooling,
            repairs — so a community that only needs a gate is already covered by the same plan. Each
            team draws from the Workforce sectors it maps to; the roster is every member who already
            matches those sectors. This recomputes live from the Directory — it updates itself as
            members and skills change.
          </div>
          {report?.sourceIssue ? (
            <a
              href={report.sourceIssue}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: t.ACCENT, textDecoration: 'none' }}
            >
              Planning document (issue #1465) ↗
            </a>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: '4px 24px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {teams.length === 0 ? (
            <div style={{ fontSize: 13, color: t.MUTED, padding: '20px 0' }}>
              No teams to show yet.
            </div>
          ) : (
            teams.map((team) => <TeamCard key={team.key} team={team} t={t} />)
          )}
        </div>
      </div>
    </div>
  );
}
