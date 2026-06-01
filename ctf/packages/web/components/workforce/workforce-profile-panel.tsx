'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { WorkforceProfile } from '../../lib/workforce/types';

const COLOR = '#B45309';

interface WorkforceProfilePanelProps {
  profile: WorkforceProfile | null;
  loading: boolean;
}

export function WorkforceProfilePanel({ profile, loading }: WorkforceProfilePanelProps) {
  return (
    <aside
      style={{
        width: 280,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: '#0D0F14',
        padding: '20px 16px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: '#4B5563',
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
            background: `${COLOR}08`,
            border: `1px solid ${COLOR}20`,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <Avatar style={{ width: 52, height: 52, margin: '0 auto 10px' }}>
            <AvatarFallback
              style={{
                background: `${COLOR}30`,
                color: COLOR,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {profile.occupationName ? profile.occupationName.charAt(0).toUpperCase() : 'W'}
            </AvatarFallback>
          </Avatar>
          <div
            style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}
          >
            {profile.occupationName ?? 'No occupation set'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#6B7280',
              marginBottom: 8,
              textTransform: 'capitalize',
            }}
          >
            {profile.skillLevel !== 'unknown' ? `Skill level: ${profile.skillLevel}` : 'Skill level not set'}
          </div>
          {profile.region ? (
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
              Region: <span style={{ color: '#9CA3AF' }}>{profile.region}</span>
            </div>
          ) : null}
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
                  color: '#6B7280',
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
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>No profile set up yet</div>
          <div style={{ fontSize: 12, color: '#4B5563' }}>
            Complete your workforce profile to be included in the tracker.
          </div>
        </div>
      ) : null}
    </aside>
  );
}
