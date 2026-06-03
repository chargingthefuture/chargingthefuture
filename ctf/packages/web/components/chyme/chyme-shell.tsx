'use client';

import Link from 'next/link';
import { ChevronLeft, Radio } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { ChymeLiveShell } from '@/components/chyme/chyme-live-shell';

type ChymeShellProps = {
  currentUser: {
    userId: string;
    username: string | null;
  };
};

export function ChymeShell({ currentUser }: ChymeShellProps) {
  const isMobile = useIsMobile();

  // Phones: drop the 72px side rail for a compact sticky top bar (back + brand)
  // and let the live shell fill the width and stack its panes vertically.
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#021006' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#030d05', borderBottom: '1px solid #052e16' }}>
          <Link
            href="/apps"
            aria-label="Back to apps"
            style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', textDecoration: 'none', flexShrink: 0 }}
          >
            <ChevronLeft size={20} />
          </Link>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22C55E', flexShrink: 0 }}>
            <Radio size={18} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#F0FDF4' }}>Chyme</span>
        </div>
        <ChymeLiveShell currentUser={currentUser} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#021006' }}>
      {/* Left navigation rail */}
      <aside
        style={{
          width: 72,
          borderRight: '1px solid #052e16',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          gap: 16,
          background: '#030d05',
          flexShrink: 0,
        }}
      >
        {/* Back button */}
        <Link
          href="/apps"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#22C55E',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.15)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.1)';
          }}
        >
          <ChevronLeft size={20} />
        </Link>

        {/* Chyme logo/icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#22C55E',
          }}
          title="Chyme chat"
        >
          <Radio size={20} />
        </div>
      </aside>

      {/* Main Chyme component */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ChymeLiveShell currentUser={currentUser} />
      </div>
    </div>
  );
}
