'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { BackChevronButton } from '@/lib/nav/back-history';
import { SimpleMarkdown } from '@/components/shared/simple-markdown';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { getDirectoryTokens, onAccentText, type DirectoryTokens } from './shared';
import { formatInviteDate, type FullInvite, type InvitePage } from './directory-invite-format';
import { INVITE_LINK_CLASS, InviteAvatar, InviteCardView } from './directory-invite-card';

const LOAD_ERROR = 'Could not load the invitations.';
const WALL_PATH = '/apps/directory/invites';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; page: InvitePage };

function useInvitePage(page: number, inviteHandle: string | undefined): Load {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ kind: 'loading' });
    const params = new URLSearchParams({ page: String(page) });
    if (inviteHandle) params.set('invite', inviteHandle);
    fetch(`/api/directory/invites?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ kind: 'error', message: await responseFailureText(res, LOAD_ERROR, 'member') });
          return;
        }
        setLoad({ kind: 'ok', page: (await res.json()) as InvitePage });
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ kind: 'error', message: failureText(caught, { area: 'directory', op: 'member_invites', fallback: LOAD_ERROR, audience: 'member' }) });
      });
    return () => controller.abort();
  }, [page, inviteHandle]);
  return load;
}

// The full invitation: opened from its card, or from a link naming the person. The picture, where
// an older invitation has one, shows only here, never on a card.
function InviteArticle({ invite, t }: { invite: FullInvite; t: DirectoryTokens }) {
  const palette = { text: t.TEXT, muted: t.SUBTLE, accent: t.ACCENT, border: t.BORDER_HI };
  return (
    <article
      aria-labelledby={`invite-${invite.slug}`}
      style={{ borderRadius: 14, border: `1px solid ${t.ACCENT}70`, background: t.SURFACE, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <InviteAvatar name={invite.name} seed={invite.quoraHandle} size={52} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h2 id={`invite-${invite.slug}`} style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.TITLE, overflowWrap: 'anywhere' }}>{invite.title}</h2>
          <time dateTime={invite.date} style={{ fontSize: 12, color: t.SUBTLE }}>{formatInviteDate(invite.date)}</time>
        </div>
      </header>
      {invite.image ? (
        <img src={invite.image.url} alt={invite.image.alt} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 10, border: `1px solid ${t.BORDER}` }} />
      ) : null}
      <SimpleMarkdown source={invite.bodyMarkdown} palette={palette} />
      <footer style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: t.SUBTLE, borderTop: `1px solid ${t.BORDER}`, paddingTop: 10 }}>
        {invite.directoryProfileUrl ? (
          <Link href={invite.directoryProfileUrl} className={INVITE_LINK_CLASS} style={{ color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>See the live listing</Link>
        ) : null}
        <span style={{ overflowWrap: 'anywhere' }}>
          {invite.name} on Quora:{' '}
          <a href={invite.quoraUrl} target="_blank" rel="noopener noreferrer" className={INVITE_LINK_CLASS} style={{ color: t.ACCENT }}>{invite.quoraUrl}</a>
        </span>
        {invite.blogUrl ? (
          <a href={invite.blogUrl} target="_blank" rel="noopener noreferrer" className={INVITE_LINK_CLASS} style={{ color: t.ACCENT, width: 'fit-content' }}>Published on the blog</a>
        ) : null}
      </footer>
    </article>
  );
}

// One invitation on the wall as a card; its link opens the full invitation at the top of this page.
function WallCard({ invite, t, page }: { invite: FullInvite; t: DirectoryTokens; page: number }) {
  return (
    <InviteCardView name={invite.name} opening={invite.opening} seed={invite.quoraHandle} date={invite.date} t={t} headingLevel={2}>
      <Link href={pageHref(page, invite.quoraHandle)} aria-label={`Read the invitation to ${invite.name}`} className={INVITE_LINK_CLASS} style={{ fontSize: 13, fontWeight: 600, color: t.ACCENT }}>
        Read the invitation
      </Link>
    </InviteCardView>
  );
}

function pageHref(page: number, inviteHandle: string | undefined): string {
  const params = new URLSearchParams({ page: String(page) });
  if (inviteHandle) params.set('invite', inviteHandle);
  return `${WALL_PATH}?${params.toString()}`;
}

function Pager({ page, t, inviteHandle }: { page: InvitePage; t: DirectoryTokens; inviteHandle?: string }) {
  if (page.pageCount <= 1) return null;
  const linkStyle = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.BORDER_HI}`, color: t.ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none' };
  return (
    <nav aria-label="Invitation pages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {page.page > 1 ? <Link href={pageHref(page.page - 1, inviteHandle)} className={INVITE_LINK_CLASS} style={linkStyle}>Previous</Link> : <span />}
      <span style={{ fontSize: 12, color: t.MUTED }}>Page {page.page} of {page.pageCount}</span>
      {page.page < page.pageCount ? <Link href={pageHref(page.page + 1, inviteHandle)} className={INVITE_LINK_CLASS} style={linkStyle}>Next</Link> : <span />}
    </nav>
  );
}

function WallBody({ load, t, inviteHandle }: { load: Load; t: DirectoryTokens; inviteHandle?: string }) {
  if (load.kind === 'loading') return <div role="status" style={{ fontSize: 13, color: t.MUTED }}>Loading the invitations…</div>;
  if (load.kind === 'error') return <div role="alert" style={{ fontSize: 13, color: '#EF4444' }}>{load.message}</div>;
  const { page } = load;
  if (page.total === 0) return <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE }}>No invitations have been written yet.</p>;
  const featured = page.invite;
  return (
    <>
      {inviteHandle && !featured ? <p role="status" style={{ margin: 0, fontSize: 13, color: t.SUBTLE }}>That invitation could not be found. It may have been taken down along with the listing.</p> : null}
      {featured ? <InviteArticle invite={featured} t={t} /> : null}
      <p style={{ margin: 0, fontSize: 12, color: t.MUTED }}>Showing {page.from}–{page.to} of {page.total}</p>
      {page.invites.filter((invite) => invite.slug !== featured?.slug).map((invite) => <WallCard key={invite.slug} invite={invite} t={t} page={page.page} />)}
      <Pager page={page} t={t} inviteHandle={inviteHandle} />
    </>
  );
}

/**
 * The invitations for any signed-in account (owner decision, 2026-10-15): each as a card with a
 * decorative avatar, its opening words and a link that opens it in full at the top of the page
 * (`?invite=<handle>`). A member not yet approved also sees the ask to finish the check (verifyUrl),
 * because the Directory itself still needs it; an approved member gets a link back to the Directory.
 * Paged ten at a time with the page number in the address, never an endless scroll.
 */
export function DirectoryInviteWall({ page, inviteHandle, verifyUrl }: { page: number; inviteHandle?: string; verifyUrl?: string }) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  const load = useInvitePage(page, inviteHandle);
  const listed = load.kind === 'ok' ? load.page.listed : null;
  return (
    <div style={{ minHeight: '100vh', background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}`, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
        <BackChevronButton accent={t.ACCENT} />
        <Mail size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>Invitations</h1>
      </div>
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE, lineHeight: 1.55 }}>
          One invitation for each person written to so far, newest first. Open one to read it in full.
          {listed !== null ? ` ${listed.toLocaleString('en-US')} ${listed === 1 ? 'person is' : 'people are'} listed in the Directory.` : ''}
        </p>
        {verifyUrl ? (
          <div style={{ borderRadius: 12, border: `1px solid ${t.ACCENT}40`, background: `${t.ACCENT}10`, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: t.TEXT, lineHeight: 1.5 }}>Finish the check to open the Directory itself: every listing, search by skill and location, and your own listing.</span>
            <a href={verifyUrl} style={{ padding: '10px', borderRadius: 10, background: t.ACCENT, color: onAccentText(t), fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Finish verifying</a>
          </div>
        ) : (
          <Link href="/apps/directory" style={{ fontSize: 13, color: t.ACCENT, fontWeight: 600 }}>Open the Directory</Link>
        )}
        <WallBody load={load} t={t} inviteHandle={inviteHandle} />
      </div>
    </div>
  );
}
