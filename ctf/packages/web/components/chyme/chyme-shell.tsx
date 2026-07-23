'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Lock, Radio, Smartphone } from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import { useTheme } from '@/hooks/useTheme';
import { ChymeLiveShell, type ChymeRoomScope } from '@/components/chyme/chyme-live-shell';
import { WeaversBadge } from '@/components/contributor-access/weavers-badge';
import { MobileTopActions } from '@/components/shared/mobile-top-actions';
import { getChymeTokens, type ChymeTokens } from './chyme-shared';

type ChymeShellProps = {
  currentUser: {
    userId: string;
    username: string | null;
  };
};

// Where the "Get the Android app" card links: the native app's APK is downloaded from the repo's
// GitHub Releases page only (owner decision 2026-07-23). On an Android device the card is hidden: the
// rail there is just the list of open rooms.
const ANDROID_APP_URL = 'https://github.com/chargingthefuture/chargingthefuture/releases';

// Detect an Android browser so the "get the app" card can be hidden there. Runs client-side only (a
// state flip after mount) so the server and first client render match and there is no hydration warning.
function useIsAndroid(): boolean {
  const [isAndroid, setIsAndroid] = useState(false);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) {
      setIsAndroid(true);
    }
  }, []);
  return isAndroid;
}

// One card in the horizontal rooms rail. Selecting it switches which room is shown below without
// tearing down any room already mounted (see the shell body) — so switching never drops a live call.
function ChymeRoomCard({
  t,
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  t: ChymeTokens;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const style: CSSProperties = {
    flexShrink: 0,
    width: 180,
    textAlign: 'left',
    padding: '12px 14px',
    borderRadius: 14,
    border: `1px solid ${active ? t.ACCENT_TINT_40 : t.BORDER}`,
    background: active ? t.ACCENT_TINT_15 : t.INPUT_BG,
    color: active ? t.ACCENT : t.SUBTLE,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };
  return (
    <button type="button" role="tab" aria-selected={active} style={style} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: active ? t.ACCENT : t.TITLE, lineHeight: 1.3 }}>{title}</span>
      </div>
      <span style={{ fontSize: 11, color: t.FAINT, lineHeight: 1.4 }}>{subtitle}</span>
    </button>
  );
}

export function ChymeShell({ currentUser }: ChymeShellProps) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  const isAndroid = useIsAndroid();

  // Which room the rail has selected. The private "Weavers of the Commons" room is switched to here;
  // a member who is not eligible simply sees the "how it's earned" explainer when they open it, never
  // a locked/absence state (no-shaming).
  const [roomScope, setRoomScope] = useState<ChymeRoomScope>('main');

  // Keep every room the member has opened MOUNTED, and just toggle which one is visible. This is the
  // whole fix for the old disconnect: the shell used to be keyed by scope, so switching rooms
  // remounted it and tore down the live audio call. Now a room opened once stays mounted (hidden with
  // display:none) so its WebRTC connection survives a switch — a member in the main room can peek at
  // the Weavers room and come back still connected. The main room is mounted from the start; the
  // private room mounts the first time it is opened.
  const [mountedScopes, setMountedScopes] = useState<ReadonlySet<ChymeRoomScope>>(new Set(['main']));

  const selectRoom = (scope: ChymeRoomScope) => {
    setMountedScopes((current) => (current.has(scope) ? current : new Set([...current, scope])));
    setRoomScope(scope);
  };

  const showAndroidCard = !isAndroid;

  const scopes = useMemo<ChymeRoomScope[]>(() => ['main', 'contributors'], []);

  // The compact top bar (back + brand) is pinned with position:sticky, and the page below flows
  // naturally. The chat message list is capped (see chyme-chat-panel) so incoming messages scroll
  // inside the chat window instead of stretching the document.
  return (
    <div style={{ minHeight: '100dvh', background: t.BG }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
        <BackChevronButton accent={t.ACCENT} />
        <div style={{ width: 32, height: 32, borderRadius: 9, background: t.ACCENT_TINT_15, border: `1px solid ${t.ACCENT_TINT_40}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ACCENT, flexShrink: 0 }}>
          <Radio size={18} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Chyme</span>
        <MobileTopActions />
      </div>

      {/* Rooms rail: a horizontal, left-to-right scroller of room cards. It stays a single compact row
          so it no longer eats a full card of vertical space above the room you are in. */}
      <div
        role="tablist"
        aria-label="Chyme rooms"
        style={{ display: 'flex', gap: 10, padding: '12px 14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderBottom: `1px solid ${t.BORDER}`, background: t.HEADER }}
      >
        <ChymeRoomCard
          t={t}
          active={roomScope === 'main'}
          onClick={() => selectRoom('main')}
          icon={<Radio size={15} />}
          title="Main Room"
          subtitle="Open to all members"
        />
        <ChymeRoomCard
          t={t}
          active={roomScope === 'contributors'}
          onClick={() => selectRoom('contributors')}
          icon={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <WeaversBadge size={15} />
              <Lock size={12} />
            </span>
          }
          title="Weavers of the Commons"
          subtitle="Private · earned by contributors"
        />
        {showAndroidCard ? (
          <a
            href={ANDROID_APP_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              flexShrink: 0,
              width: 180,
              padding: '12px 14px',
              borderRadius: 14,
              border: `1px dashed ${t.BORDER_STRONG}`,
              background: t.INPUT_BG,
              color: t.SUBTLE,
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={15} />
              <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, lineHeight: 1.3 }}>Get the Android app</span>
            </div>
            <span style={{ fontSize: 11, color: t.FAINT, lineHeight: 1.4 }}>Download the APK from GitHub releases</span>
          </a>
        ) : null}
      </div>

      {/* Every opened room stays mounted; only the active one is displayed. display:none keeps the
          hidden room's audio call alive, which is what stops a room switch from disconnecting. */}
      {scopes.map((scope) =>
        mountedScopes.has(scope) ? (
          <div key={scope} style={{ display: scope === roomScope ? 'block' : 'none' }}>
            <ChymeLiveShell currentUser={currentUser} roomScope={scope} />
          </div>
        ) : null,
      )}
    </div>
  );
}
