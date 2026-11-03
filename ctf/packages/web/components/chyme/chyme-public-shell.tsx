'use client';

import { useSignedOutTheme } from '@/components/se-frame/use-signed-out-theme';
import { LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { ChymeGuestListen, GuestNote } from '@/components/chyme/chyme-guest-listen';
import { ChymeUpcoming } from '@/components/chyme/chyme-upcoming';
import { ChymeReadingsPlayer } from '@/components/chyme/readings/chyme-readings-player';
import Link from 'next/link';
import { HOSTING_NOT_ENDORSEMENT_SHORT, SE_ROOM_MAIN_AUDIENCE, SE_ROOM_RULE, seTheme } from '@ctf/shared';
import { seThemeVars } from '@/components/se-frame/se-theme-vars';
import frame from '@/components/se-frame/se-frame.module.css';
import { ChymeTokensContext, seChymeTokens, useChymeTokens } from './chyme-tokens-context';

// Live state for the one default public Chyme room, fetched client-side from
// /api/chyme/public/room. Whether a guest can listen is the route's `guestListenAllowed`; the
// listen credentials themselves are minted on the tap (POST /api/chyme/public/listen, inside
// ChymeGuestListen), so a page load touches nothing on Stream.
type LiveState = {
  isLive: boolean;
  participantCount: number;
  // Signed-out listeners on the roster right now. Shown beside the member count so the page says
  // how many people are in the room rather than how many of them happen to have accounts.
  guestCount: number;
  roomName?: string;
  guestListenAllowed?: boolean;
  // The room is live but guests cannot listen right now — the route's plain reason (the quota
  // policy has guest listening paused). Shown under the room heading.
  listenUnavailable?: string;
  // The live check itself failed (a 429, a 503, no network). Shown instead of the empty state, so
  // "no rooms" is only ever said when the server actually said so.
  checkFailed?: string;
};

// Wiring for the Leave control in the Live Rooms row. The listener itself sits further down the
// tree (ChymeGuestListen), so the page holds the two ends: whether sound is actually on, and a
// counter the listener watches to stop the listen when the visitor presses Leave.
type GuestListenControl = {
  listening: boolean;
  onListeningChange: (listening: boolean) => void;
  leaveKey: number;
};

// The page is drawn in the member's 3.1 colors (seChymeTokens), and the room list reads the same
// colors through useChymeTokens, so the guest view matches the rest of signed-out 3.1.

type PublicRoomPayload = Record<string, unknown> & { ok: true };

function isOkPayload(data: unknown): data is PublicRoomPayload {
  return typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok === true;
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

function liveStateFrom(data: PublicRoomPayload): LiveState {
  return {
    isLive: data.isLive === true,
    participantCount: typeof data.participantCount === 'number' ? data.participantCount : 0,
    guestCount: typeof data.guestCount === 'number' ? data.guestCount : 0,
    roomName: stringField(data, 'roomName'),
    guestListenAllowed: data.guestListenAllowed === true,
    listenUnavailable: stringField(data, 'listenUnavailable'),
  };
}

// The server's own words when it gave any (`message` on this app's error bodies, `error` on the
// rate limiter's), then the status so a 429 and a 503 read differently on the page.
function failedCheck(status: number, data: unknown): LiveState {
  const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const serverMessage = stringField(body, 'message') ?? stringField(body, 'error') ?? 'The server returned an error.';
  return { isLive: false, participantCount: 0, guestCount: 0, checkFailed: `${serverMessage} (HTTP ${status})` };
}

// Four states, each said plainly. Before this, two of them rendered as something else: a failed
// live check fell through to the initial not-live state and read "No public rooms right now", and
// a live room with no guest identity matched neither branch and rendered nothing at all. A visitor
// looking at a blank space under a live room, or at "no rooms" while a member is audibly in the
// call, has no way to tell what happened — and neither has the person they report it to.
function ChymePublicRoomList({ live, onRoomGone, listen }: { live: LiveState; onRoomGone: () => void; listen: GuestListenControl }) {
  const t = useChymeTokens();

  if (live.checkFailed) {
    return (
      <div style={{ borderRadius: 10, border: `1px dashed ${t.BORDER}`, padding: '20px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>Couldn&apos;t check whether a room is live</div>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5, wordBreak: 'break-word' }}>{live.checkFailed}</div>
      </div>
    );
  }

  if (!live.isLive) {
    return (
      <div style={{ borderRadius: 10, border: `1px dashed ${t.BORDER}`, padding: '20px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>No public rooms right now</div>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Public rooms show up here when hosts go live. The TI Radio guide above says when the next one is.</div>
        {/* The readings loop, only while it is switched on (temporary module, 2026-09-28). */}
        <ChymeReadingsPlayer onRoomLive={onRoomGone} />
      </div>
    );
  }

  return (
    <div>
      {live.roomName ? <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>{live.roomName}</div> : null}
      {live.guestListenAllowed ? (
        <>
          {/* Said before the tap, so it cannot claim the visitor is already listening (owner report,
              2026-09-19); the listener component says "Listening live" itself once the sound is on. */}
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>The room is live. Tap below to listen; sign in to speak.</div>
          <ChymeGuestListen
            participantCount={live.participantCount}
            guestCount={live.guestCount}
            accent={t.ACCENT}
            onRoomGone={onRoomGone}
            onListeningChange={listen.onListeningChange}
            leaveKey={listen.leaveKey}
          />
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>The room is live — sign in to join it.</div>
          <GuestNote
            accent={t.ACCENT}
            text="Listening in without an account isn't available right now."
            detail={live.listenUnavailable ?? 'The server sent no reason.'}
          />
        </>
      )}
    </div>
  );
}

function ChymePublicView({
  signInUrl,
  verifyUrl,
  live,
  onRoomGone,
  onRefresh,
  refreshing,
  refreshKey,
  listen,
  onLeave,
}: {
  signInUrl: string;
  verifyUrl?: string;
  live: LiveState;
  onRoomGone: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshKey: number;
  listen: GuestListenControl;
  onLeave: () => void;
}) {
  const seChoice = useSignedOutTheme();
  const se = seTheme(seChoice.color, seChoice.mode);
  const t = seChymeTokens(se);
  return (
    // The signed-out room page in the 3.1 look (owner report, 2026-11-02: it still drew Chyme's 3.0
    // green design while the rest of signed-out 3.1 had moved on). The frame, title and cards come
    // from the 3.1 frame; Chyme's parts below read the same colors through ChymeTokensContext.
    <ChymeTokensContext.Provider value={t}>
    <div className={frame.frame} style={seThemeVars(seChoice.color, seChoice.mode)}>
      <main className={frame.screen} style={{ paddingBottom: 48 }}>
        <Link href="/today" style={{ alignSelf: 'flex-start', color: se.ink, fontSize: 14, textDecoration: 'underline' }}>
          Back to Today
        </Link>
        <header className={frame.header}>
          <span className={frame.eyebrow}>Chyme · live audio</span>
          <h1 className={frame.title}>Main Room</h1>
          <span className={frame.eyebrow}>{SE_ROOM_MAIN_AUDIENCE}</span>
          <span className={frame.eyebrow}>{SE_ROOM_RULE}</span>
        </header>

        {/* Invitation card: listening needs no account; signing in is for speaking, reacting and
            hosting. One sign-in control (owner directive, 2026-09-29). */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderRadius: 18, border: `1.5px solid ${se.hair}`, background: se.card }}>
          <strong style={{ fontSize: 16 }}>Live audio rooms for survivors</strong>
          <span style={{ fontSize: 15, lineHeight: 1.4, color: se.soft }}>Listen in for free. Sign in to speak, react, or host your own room.</span>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: se.soft }}>{HOSTING_NOT_ENDORSEMENT_SHORT}</span>
          <a href={verifyUrl ?? signInUrl} className={frame.signInButton}>
            {verifyUrl ? 'Finish verifying' : 'Sign in'}
          </a>
        </section>

      {/* Room list. The label row carries the same refresh control the signed-in page has beside
          Join Room (owner directive, 2026-09-18: the two screens should match, and the installed app
          on Android has no browser reload). It re-reads the room; a listener already
          in the call keeps their connection. Beside it, while sound is on, a Leave control — before
          it, a visitor listening in had no way to stop short of closing the tab or reloading a long
          page (owner report, 2026-09-20). It shows only while there is a call to leave. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* What is coming up on the TI Radio guide, so a visitor at a quiet room knows when to come
            back (scheduled rooms MVP, 2026-09-19). Same refresh control as the room.
            Above the room, where the signed-in page has it (owner directive, 2026-09-30). */}
        <div style={{ borderRadius: 10, border: `1px solid ${t.BORDER}`, overflow: 'hidden' }}>
          <ChymeUpcoming refreshKey={refreshKey} compact />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Rooms</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {listen.listening ? (
              <button
                type="button"
                onClick={onLeave}
                aria-label="Leave the room and stop listening"
                title="Leave the room and stop listening"
                style={{ height: 44, padding: '0 14px', borderRadius: 12, background: t.INPUT_BG, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: t.TITLE, fontSize: 12, fontWeight: 700 }}
              >
                <LogOut size={15} /> Leave
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh the room"
              title="Refresh the room"
              style={{ width: 44, height: 44, borderRadius: 12, background: t.INPUT_BG, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'wait' : 'pointer', color: t.MUTED, flexShrink: 0 }}
            >
              <RefreshCw size={16} className={refreshing ? 'ctf-spin' : undefined} />
            </button>
          </div>
        </div>
        <ChymePublicRoomList live={live} onRoomGone={onRoomGone} listen={listen} />
      </div>

      {/* No bottom bar. A grayed, locked "Start a Room" sat here until 2026-09-18 as the statement
          that hosting needs an account; the owner removed it — a control that does nothing is
          noise to a visitor who is not signed in, and the invitation card already says what signing
          in gets you. */}
      </main>
    </div>
    </ChymeTokensContext.Provider>
  );
}

/**
 * Signed-out visitor view for Chyme. Renders the public marketing / empty-state
 * experience pixel-faithful to the MobileChymePublic (phone) design mockup — the one layout the
 * app ships at every width — with sign-in affordances pointing at the real hosted
 * sign-in URL. It shows no private or per-user data: there is no public room
 * feed yet, so the room list renders an honest empty state rather than the
 * mockup's placeholder rooms.
 */
export function ChymePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  // Fetch the one default public room's live status once on mount. The listen credentials are
  // minted on the visitor's tap, not here, so a page load costs nothing on Stream.
  const [live, setLive] = useState<LiveState>({ isLive: false, participantCount: 0, guestCount: 0 });
  const [refreshing, setRefreshing] = useState(false);
  // Bumped by the refresh button; the upcoming list re-reads when it changes.
  const [refreshKey, setRefreshKey] = useState(0);
  // Whether the visitor's sound is actually on, reported by the listener below. The Leave control
  // in the Live Rooms row shows only while it is true.
  const [listening, setListening] = useState(false);
  // Bumped by the Leave control; the listener stops the call when it changes.
  const [leaveKey, setLeaveKey] = useState(0);

  const loadLive = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/chyme/public/room', signal ? { signal } : undefined);
      const data: unknown = await res.json().catch(() => null);
      // Say that the check failed, with the server's own words when it gave any. Treating this as
      // "not live" read as "No public rooms right now" while a member was in the call.
      // A re-read while the room is still live does not touch the listener: the credentials live
      // inside ChymeGuestListen, which stays mounted while `guestListenAllowed` holds.
      setLive(res.ok && isOkPayload(data) ? liveStateFrom(data) : failedCheck(res.status, data));
    } catch (error) {
      if (signal?.aborted) return;
      setLive({ isLive: false, participantCount: 0, guestCount: 0, checkFailed: error instanceof Error ? error.message : 'The request did not complete.' });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadLive(controller.signal);
    return () => controller.abort();
  }, [loadLive]);

  // The listener could not join and a fresh read said the room had ended. Re-read the room so the
  // page falls back to the honest "no public rooms right now" state instead of leaving a dead error
  // box under a heading telling the visitor they are listening live.
  const handleRoomGone = useCallback(() => {
    void loadLive();
  }, [loadLive]);

  // The refresh button: re-read the room, then tell the upcoming list to re-read too. `refreshing`
  // drives the spinning icon so the press is visible even when nothing changed.
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadLive();
      setRefreshKey((n) => n + 1);
    } finally {
      setRefreshing(false);
    }
  }, [loadLive, refreshing]);

  // Leave: tell the listener to stop. No room re-read here on purpose — the listener posts its
  // leave as it tears the call down, so a read fired at the same moment would race it and come
  // back still counting this visitor. The listener drops itself from its own count instead, and
  // the refresh control beside Leave re-reads the room when the visitor wants the server's number.
  const handleLeave = useCallback(() => {
    setLeaveKey((n) => n + 1);
  }, []);

  // One layout at every width (mobile-first, owner decision 2026-07-20): the desktop two-column
  // branch this file used to carry was hidden by CSS at every width, so it never rendered.
  // `ctf-self-responsive` opts this wrapper out of the small-screen un-row fallback so the phone
  // layout below manages its own flex column.
  return (
    <div className="ctf-self-responsive">
      <ChymePublicView
        signInUrl={signInUrl}
        verifyUrl={verifyUrl}
        live={live}
        onRoomGone={handleRoomGone}
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
        refreshKey={refreshKey}
        listen={{ listening, onListeningChange: setListening, leaveKey }}
        onLeave={handleLeave}
      />
    </div>
  );
}
