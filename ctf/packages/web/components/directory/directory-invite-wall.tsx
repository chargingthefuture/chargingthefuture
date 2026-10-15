'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { BackChevronButton } from '@/lib/nav/back-history';
import { SimpleMarkdown } from '@/components/shared/simple-markdown';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { getDirectoryTokens, type DirectoryTokens } from './shared';
import { formatInviteDate, type FullInvite, type InvitePage } from './directory-invite-format';

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

function InviteArticle({ invite, t, highlighted }: { invite: FullInvite; t: DirectoryTokens; highlighted?: boolean }) {
  const palette = { text: t.TEXT, muted: t.SUBTLE, accent: t.ACCENT, border: t.BORDER_HI };
  return (
    <article
      aria-labelledby={`invite-${invite.slug}`}
      style={{ borderRadius: 14, border: `1px solid ${highlighted ? `${t.ACCENT}70` : t.BORDER_HI}`, background: t.SURFACE, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: t.MUTED }}>{formatInviteDate(invite.date)}</span>
        <h2 id={`invite-${invite.slug}`} style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.TITLE }}>{invite.title}</h2>
      </header>
      {invite.image ? (
        <img src={invite.image.url} alt={invite.image.alt} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 10, border: `1px solid ${t.BORDER}` }} />
      ) : null}
      <SimpleMarkdown source={invite.bodyMarkdown} palette={palette} />
      <footer style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: t.SUBTLE, borderTop: `1px solid ${t.BORDER}`, paddingTop: 10 }}>
        <span style={{ overflowWrap: 'anywhere' }}>
          {invite.name} on Quora:{' '}
          <a href={invite.quoraUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.ACCENT }}>{invite.quoraUrl}</a>
        </span>
        {invite.blogUrl ? (
          <a href={invite.blogUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.ACCENT }}>Published on the blog</a>
        ) : null}
        {invite.directoryProfileUrl ? (
          <Link href={invite.directoryProfileUrl} style={{ color: t.ACCENT, fontWeight: 600 }}>Open {invite.name}&apos;s Directory listing</Link>
        ) : null}
      </footer>
    </article>
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
      {page.page > 1 ? <Link href={pageHref(page.page - 1, inviteHandle)} style={linkStyle}>Previous</Link> : <span />}
      <span style={{ fontSize: 12, color: t.MUTED }}>Page {page.page} of {page.pageCount}</span>
      {page.page < page.pageCount ? <Link href={pageHref(page.page + 1, inviteHandle)} style={linkStyle}>Next</Link> : <span />}
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
      {featured ? <InviteArticle invite={featured} t={t} highlighted /> : null}
      <p style={{ margin: 0, fontSize: 12, color: t.MUTED }}>Showing {page.from}–{page.to} of {page.total}</p>
      {page.invites.filter((invite) => invite.slug !== featured?.slug).map((invite) => <InviteArticle key={invite.slug} invite={invite} t={t} />)}
      <Pager page={page} t={t} inviteHandle={inviteHandle} />
    </>
  );
}

/**
 * The invitations in full, for any signed-in account (owner decision, 2026-10-15). A member not yet
 * approved also sees the ask to finish the check (verifyUrl), because the Directory itself still
 * needs it; an approved member gets a link back to the Directory. Paged ten at a time with the page
 * number in the address, never an endless scroll.
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
          One invitation for each person written to so far, newest first.
          {listed !== null ? ` ${listed.toLocaleString('en-US')} ${listed === 1 ? 'person is' : 'people are'} listed in the Directory.` : ''}
        </p>
        {verifyUrl ? (
          <div style={{ borderRadius: 12, border: `1px solid ${t.ACCENT}40`, background: `${t.ACCENT}10`, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: t.TEXT, lineHeight: 1.5 }}>Finish the check to open the Directory itself: every listing, search by skill and location, and your own listing.</span>
            <a href={verifyUrl} style={{ padding: '10px', borderRadius: 10, background: t.ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Finish verifying</a>
          </div>
        ) : (
          <Link href="/apps/directory" style={{ fontSize: 13, color: t.ACCENT, fontWeight: 600 }}>Open the Directory</Link>
        )}
        <WallBody load={load} t={t} inviteHandle={inviteHandle} />
      </div>
    </div>
  );
}
