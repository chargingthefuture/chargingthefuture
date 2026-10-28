'use client';

import { useState } from 'react';
import { VideoPreview, useCallStateHooks } from '@stream-io/video-react-sdk';
import { Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { BlurBackgroundToggle } from '@/components/shared/call-safety';
import { getPeerProgrammingTokens } from './pp-shared';

// Before joining: the member sees their own camera, can turn the camera and microphone off or on and
// blur their background, then joins (3.1.0 plan, pre-call camera and microphone check).
export function PeerProgrammingCallLobby({
  deviceNotices,
  onJoin,
  onCancel,
}: {
  deviceNotices: string[];
  onJoin: () => Promise<void>;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const { useCameraState, useMicrophoneState } = useCallStateHooks();
  const { camera, isMute: cameraOff } = useCameraState();
  const { microphone, isMute: micOff } = useMicrophoneState();
  const [joining, setJoining] = useState(false);

  const toggle = (on: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    padding: '6px 14px',
    borderRadius: 999,
    border: `1px solid ${t.ACCENT}40`,
    background: on ? `${t.ACCENT}20` : 'transparent',
    color: on ? t.ACCENT : t.SUBTLE,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Check your camera and microphone</div>
      <div className="pp-participant-tile" style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' }}>
        <VideoPreview />
      </div>
      {deviceNotices.map((notice) => (
        <div key={notice} role="status" style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: 13, lineHeight: 1.5 }}>
          {notice}
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={() => void microphone.toggle()} aria-pressed={!micOff} style={toggle(!micOff)}>
          {micOff ? <MicOff size={16} /> : <Mic size={16} />} {micOff ? 'Microphone off' : 'Microphone on'}
        </button>
        <button type="button" onClick={() => void camera.toggle()} aria-pressed={!cameraOff} style={toggle(!cameraOff)}>
          {cameraOff ? <VideoOff size={16} /> : <VideoIcon size={16} />} {cameraOff ? 'Camera off' : 'Camera on'}
        </button>
        <BlurBackgroundToggle color={t.ACCENT} border={`${t.ACCENT}40`} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={joining}
          onClick={() => {
            setJoining(true);
            void onJoin().finally(() => setJoining(false));
          }}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', background: t.ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: joining ? 'default' : 'pointer', opacity: joining ? 0.7 : 1 }}
        >
          {joining ? 'Joining…' : 'Join session'}
        </button>
        <button type="button" onClick={onCancel} style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, border: `1px solid ${t.BORDER}`, background: 'transparent', color: t.SUBTLE, fontSize: 14, cursor: 'pointer' }}>
          Back
        </button>
      </div>
    </div>
  );
}
