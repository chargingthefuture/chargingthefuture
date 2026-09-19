'use client';

import { Radio, LogIn, UserPlus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';
import { ChymeGuestListen, GuestNote } from '@/components/chyme/chyme-guest-listen';
import { ChymeGuestChat } from '@/components/chyme/chyme-guest-chat';
import { HOSTING_NOT_ENDORSEMENT_SHORT } from '@ctf/shared';

// Live state for the one default public Chyme room, fetched client-side from
// /api/chyme/public/room. Whether a guest can listen is the route's `guestListenAllowed`; the
// listen credentials themselves are minted on the tap (POST /api/chyme/public/listen, inside
// ChymeGuestListen), so a page load touches nothing on Stream.
type LiveState = {
  isLive: boolean;
  participantCount: number;
  roomName?: string;
  guestListenAllowed?: boolean;
  // The room is live but guests cannot listen right now — the route's plain reason (the quota
  // policy has guest listening paused). Shown under the room heading.
  listenUnavailable?: string;
  // The live check itself failed (a 429, a 503, no network). Shown instead of the empty state, so
  // "no rooms" is only ever said when the server actually said so.
  checkFailed?: string;
};

// Chyme's brand is green. The signed-out (guest) shell must look like the signed-in app, not a
// different purple product — so these mirror the deep-green chrome from chyme-shared (page #04160A,
// card #041a0b, divider #052e16, mint-white title) and the green accent. The old purple/cyan accent
// made the guest view look like a separate app.
// Chrome tokens come from getChymeTokens(theme) (t.BG page, t.BORDER divider, t.TITLE bright
// text, t.MUTED gray, t.ACCENT green). Two values have no token slot and stay static:
const SURFACE = '#041a0b'; // card surface — no getter field matches this hex
const ACCENT_CYAN = '#16A34A'; // deep-green gradient partner — no getter field matches

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

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
  return { isLive: false, participantCount: 0, checkFailed: `${serverMessage} (HTTP ${status})` };
}

// Four states, each said plainly. Before this, two of them rendered as something else: a failed
// live check fell through to the initial not-live state and read "No public rooms right now", and
// a live room with no guest identity matched neither branch and rendered nothing at all. A visitor
// looking at a blank space under a live room, or at "no rooms" while a member is audibly in the
// call, has no way to tell what happened — and neither has the person they report it to.
function ChymePublicRoomList({ live, onRoomGone, signInUrl, refreshKey }: { live: LiveState; onRoomGone: () => void; signInUrl: string; refreshKey: number }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);

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
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>Public rooms show up here when hosts go live. Sign in to start one or get notified.</div>
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
          <ChymeGuestListen participantCount={live.participantCount} accent={t.ACCENT} onRoomGone={onRoomGone} />
          {/* The room chat, read-only, under the stage (owner directive, 2026-09-18): a visitor can
              follow what members are saying and signs in to write. */}
          <div style={{ marginTop: 16 }}>
            <ChymeGuestChat signInUrl={signInUrl} refreshKey={refreshKey} />
          </div>
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
}: {
  signInUrl: string;
  verifyUrl?: string;
  live: LiveState;
  onRoomGone: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshKey: number;
}) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    // The page itself scrolls — the shell is only *at least* one viewport tall and nothing inside it
    // owns a scrollbar. Pinned to exactly 100dvh with an inner scrolling box, the document never
    // scrolls, and Safari's "Full Page" screenshot has nothing to extend past the first viewport.
    // The header keeps its shipped always-visible behavior via position: sticky.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TITLE }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${t.ACCENT} 0%, ${ACCENT_CYAN} 100%)`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
        <PublicShellBackLink />
        <Radio size={16} color="#fff" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Chyme</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Live audio for survivors</div>
        </div>
        {/* No sign-in or join action here (owner directive, 2026-09-17). The same pair of buttons
            sat in the header, on the invitation card, and in the bottom bar — one page asking three
            times. The invitation card is the one that keeps it: it is the only one of the three that
            says what signing in gets you. The header is a title bar and the back control. */}
      </div>

      {/* The room search box and the Healing / Economy / Housing / Legal / Skills tags were here
          (removed by owner directive, 2026-09-17). There is one public room — the main room; the
          Weavers room is private and never appears here — so both controls offered to narrow a list
          of one. Neither worked either: the input was `readOnly` and the tags were plain spans with
          no click handler, so a visitor who tried them got nothing back and no explanation. They
          belong on this page again when it lists more than one room, and at that point they need
          real behavior rather than to be un-hidden — searching and filtering are not built. */}

      {/* Invitation card */}
      <div style={{ margin: '10px 12px 0', borderRadius: 14, border: `1px solid ${t.ACCENT}30`, background: `${t.ACCENT}06`, padding: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, borderRadius: 20, padding: '2px 8px' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.ACCENT }} />
            <span style={{ fontSize: 10, color: t.ACCENT, fontWeight: 700 }}>LIVE AUDIO</span>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>Live audio rooms for survivors</div>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12, lineHeight: 1.5 }}>Listen in for free. Sign in to speak, react, or host your own room.</div>
        {/* On the always-visible invitation card rather than beside the live player. Inside the
            isLive branch this showed only to somebody already listening — the one person who least
            needs telling — and a signed-out visitor arriving from the TI Radio schedule usually gets
            here BEFORE the room goes live. Same statement as the TI Radio guide, one shared string,
            so the two can never drift into disagreeing about what a listing means. */}
        <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 12, lineHeight: 1.5 }}>
          {HOSTING_NOT_ENDORSEMENT_SHORT}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {verifyUrl ? (
            <a href={verifyUrl} style={{ flex: 1, padding: '9px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none' }}>
              Finish verifying
            </a>
          ) : (
            <>
              <a href={signInUrl} style={{ flex: 1, padding: '9px', borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none' }}>
                <UserPlus size={13} /> Join Free to Listen
              </a>
              <a href={signInUrl} style={{ padding: '9px 14px', borderRadius: 9, background: SURFACE, border: `1px solid ${t.BORDER}`, color: t.MUTED, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                <LogIn size={13} /> Sign In
              </a>
            </>
          )}
        </div>
      </div>

      {/* Room list. The label row carries the same refresh control the signed-in page has beside
          Join Room (owner directive, 2026-09-18: the two screens should match, and the installed app
          on Android has no browser reload). It re-reads the room and the chat; a listener already
          in the call keeps their connection. */}
      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Rooms</div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh the room and chat"
            title="Refresh the room and chat"
            style={{ width: 44, height: 44, borderRadius: 12, background: t.INPUT_BG, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'wait' : 'pointer', color: t.MUTED, flexShrink: 0 }}
          >
            <RefreshCw size={16} className={refreshing ? 'ctf-spin' : undefined} />
          </button>
        </div>
        <ChymePublicRoomList live={live} onRoomGone={onRoomGone} signInUrl={signInUrl} refreshKey={refreshKey} />
      </div>

      {/* No bottom bar. A grayed, locked "Start a Room" sat here until 2026-09-18 as the statement
          that hosting needs an account; the owner removed it — a control that does nothing is
          noise to a visitor who is not signed in, and the invitation card already says what signing
          in gets you. */}
    </div>
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
  const [live, setLive] = useState<LiveState>({ isLive: false, participantCount: 0 });
  const [refreshing, setRefreshing] = useState(false);
  // Bumped by the refresh button; the chat panel re-reads when it changes.
  const [refreshKey, setRefreshKey] = useState(0);

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
      setLive({ isLive: false, participantCount: 0, checkFailed: error instanceof Error ? error.message : 'The request did not complete.' });
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

  // The refresh button: re-read the room, then tell the chat panel to re-read too. `refreshing`
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
      />
    </div>
  );
}
