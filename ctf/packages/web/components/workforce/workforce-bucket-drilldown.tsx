'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { WorkforceBucketDetail, WorkforceGroupedReportItem } from '../../lib/workforce/types';
import { WorkforceMemberList } from './workforce-member-list';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';

type DrilldownKind = 'sector' | 'skill-level';

// One expandable bucket row. Lazy-loads the matched-member detail the first time it is opened — the
// V2 collapsible sector/skill-level drilldown.
function BucketRow({ kind, item }: { kind: DrilldownKind; item: WorkforceGroupedReportItem }) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WorkforceBucketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && detail === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workforce/reports/${kind}/${encodeURIComponent(item.bucket)}`);
        if (!res.ok) {
          throw new Error(`Request failed (${res.status}).`);
        }
        const json = (await res.json()) as { detail?: WorkforceBucketDetail | null };
        setDetail(json.detail ?? { ...item, matchedMembers: [] });
      } catch {
        setError('Could not load members for this bucket.');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 6px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {open ? (
          <ChevronDown size={16} style={{ color: t.MUTED, flexShrink: 0 }} />
        ) : (
          <ChevronRight size={16} style={{ color: t.MUTED, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, fontSize: 14, color: t.TEXT, textTransform: 'capitalize' }}>
          {item.bucket}
        </span>
        <span style={{ fontSize: 12, color: t.MUTED }}>
          {item.recruited.toLocaleString()} recruited / {item.target.toLocaleString()} target
        </span>
        <span
          style={{
            width: 96,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: 700,
            color: item.gap > 0 ? t.ACCENT : '#22C55E',
            flexShrink: 0,
          }}
        >
          {item.gap > 0 ? `${item.gap.toLocaleString()} to fill` : 'filled'}
        </span>
      </button>

      {open ? (
        <div style={{ padding: '4px 6px 16px 34px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.MUTED, fontSize: 13 }}>
              <Loader2 size={14} className="ctf-spin" /> Loading members…
            </div>
          ) : error ? (
            <div style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>
          ) : (
            <WorkforceMemberList members={detail?.matchedMembers ?? []} />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function WorkforceBucketDrilldown({
  kind,
  title,
  items,
}: {
  kind: DrilldownKind;
  title: string;
  items: WorkforceGroupedReportItem[];
}) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  return (
    <div
      style={{
        padding: '20px 24px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: t.MUTED }}>No data yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item) => (
            <BucketRow key={item.bucket} kind={kind} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
