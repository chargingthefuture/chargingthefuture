'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { WorkforceProfile } from '../../lib/workforce/types';
import { useTheme } from '@/hooks/useTheme';
import { getWorkforceTokens } from './workforce-shared';

interface WorkforceProfilePanelProps {
  profile: WorkforceProfile | null;
  loading: boolean;
}

export function WorkforceProfilePanel({ profile, loading }: WorkforceProfilePanelProps) {
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);
  return (
    <aside
      style={{
        width: 280,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: t.HEADER,
        padding: '20px 16px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: t.FAINT,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Your Workforce Profile
      </div>

      {profile ? (
        <div
          style={{
            padding: '16px',
            borderRadius: 14,
            background: `${t.ACCENT}08`,
            border: `1px solid ${t.ACCENT}20`,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <Avatar style={{ width: 52, height: 52, margin: '0 auto 10px' }}>
            <AvatarFallback
              style={{
                background: `${t.ACCENT}30`,
                color: t.ACCENT,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {profile.occupationName ? profile.occupationName.charAt(0).toUpperCase() : 'W'}
            </AvatarFallback>
          </Avatar>
          <div
            style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}
          >
            {profile.occupationName ?? 'No occupation set'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: t.MUTED,
              marginBottom: 8,
              textTransform: 'capitalize',
            }}
          >
            {profile.skillLevel !== 'unknown' ? `Skill level: ${profile.skillLevel}` : 'Skill level not set'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {profile.recruitedState ? (
              <Badge
                style={{
                  background: '#22C55E20',
                  color: '#22C55E',
                  border: '1px solid #22C55E35',
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 20,
                }}
              >
                ✓ Recruited
              </Badge>
            ) : (
              <Badge
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: t.MUTED,
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 20,
                }}
              >
                Not yet recruited
              </Badge>
            )}
          </div>
        </div>
      ) : !loading ? (
        <div
          style={{
            padding: '16px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: t.MUTED, marginBottom: 8 }}>No profile set up yet</div>
          <div style={{ fontSize: 12, color: t.FAINT }}>
            Complete your workforce profile to be included in the tracker.
          </div>
        </div>
      ) : null}
    </aside>
  );
}
