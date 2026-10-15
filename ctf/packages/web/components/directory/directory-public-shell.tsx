'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { getDirectoryTokens, type DirectoryTokens } from './shared';
import { PublicShellWorldwide } from '@/components/plugins/public-shell-worldwide';
import { formatInviteDate, type InviteCard, type InviteTeaser, type OpenInviteCard, type PublicInvites } from './directory-invite-format';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";
const LOAD_ERROR = 'Could not load the invitations.';

type DirectoryPublicShellProps = PublicVisitorShellProps & {
  // The Quora handle from a direct link (/apps/directory?invite=<handle>): that person's card shows on top.
  inviteHandle?: string;
  signUpUrl?: string;
  // The page of the open (already public) invitations, from ?page= in the address.
  page?: number;
};

function usePublicInvites(inviteHandle: string | undefined, page: number) {
  const [data, setData] = useState<PublicInvites | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (inviteHandle) params.set('invite', inviteHandle);
    fetch(`/api/directory/invites/public?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setError(await responseFailureText(res, LOAD_ERROR, 'member'));
          return;
        }
        setData((await res.json()) as PublicInvites);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(failureText(caught, { area: 'directory', op: 'public_invites', fallback: LOAD_ERROR, audience: 'member' }));
      });
    return () => controller.abort();
  }, [inviteHandle, page]);
  return { data, error };
}

const cardStyle = (t: DirectoryTokens) => ({ borderRadius: 12, border: `1px solid ${t.BORDER_HI}`, background: t.SURFACE, padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: 6 });

function BlogLink({ href, t }: { href: string; t: DirectoryTokens }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: t.ACCENT }}>Read the invitation</a>;
}

// A private invite as a visitor may see it: name and opening words. A public one adds its blog link.
function CondensedCard({ card, t }: { card: InviteCard | InviteTeaser; t: DirectoryTokens }) {
  const dated = 'date' in card ? card : null;
  return (
    <div style={cardStyle(t)}>
      {dated ? <span style={{ fontSize: 11, color: t.MUTED }}>{formatInviteDate(dated.date)}</span> : null}
      <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>An invitation to {card.name}</span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: t.SUBTLE, overflowWrap: 'anywhere' }}>{card.opening}</p>
      {dated?.blogUrl ? <BlogLink href={dated.blogUrl} t={t} /> : null}
    </div>
  );
}

// An invite already published on the blog: readable in the open, picture included.
function OpenCard({ card, t }: { card: OpenInviteCard; t: DirectoryTokens }) {
  return (
    <article style={cardStyle(t)}>
      <span style={{ fontSize: 11, color: t.MUTED }}>{formatInviteDate(card.date)}</span>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.TITLE }}>An invitation to {card.name}</h3>
      {card.image ? (
        <img src={card.image.url} alt={card.image.alt} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 10, border: `1px solid ${t.BORDER}` }} />
      ) : null}
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: t.SUBTLE, overflowWrap: 'anywhere' }}>{card.opening}</p>
      <BlogLink href={card.blogUrl} t={t} />
    </article>
  );
}

function Pitch({ t, signInUrl, signUpUrl, verifyUrl }: { t: DirectoryTokens; signInUrl: string; signUpUrl?: string; verifyUrl?: string }) {
  if (verifyUrl) {
    return (
      <a href={verifyUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Finish verifying</a>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE, lineHeight: 1.55 }}>
        Sign in free to read every invitation. Listed already? Make an account and your listing can be attached to it. Not listed yet? Make an account, finish the check, and add yourself.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <a href={signInUrl} style={{ flex: 1, padding: '12px', borderRadius: 12, background: t.ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Sign in</a>
        <a href={signUpUrl ?? signInUrl} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${t.ACCENT}60`, color: t.ACCENT, fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Create a free account</a>
      </div>
    </div>
  );
}

function FeaturedInvite({ handle, data, t }: { handle?: string; data: PublicInvites | null; t: DirectoryTokens }) {
  if (!handle || !data) return null;
  if (!data.invite) {
    return <p role="status" style={{ margin: 0, fontSize: 13, color: t.SUBTLE }}>That invitation could not be found. It may have been taken down along with the listing.</p>;
  }
  return (
    <section aria-label="The invitation you followed" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <CondensedCard card={data.invite} t={t} />
      {data.invite.blogUrl ? null : <span style={{ fontSize: 12, color: t.MUTED }}>Sign in to read the full invitation.</span>}
    </section>
  );
}

function pageHref(page: number, handle: string | undefined): string {
  const params = new URLSearchParams({ page: String(page) });
  if (handle) params.set('invite', handle);
  return `/apps/directory?${params.toString()}`;
}

// The invites already published on the blog, ten a page with the page number in the address.
function OpenWall({ wall, t, handle }: { wall: PublicInvites['openWall']; t: DirectoryTokens; handle?: string }) {
  if (wall.total === 0) return null;
  const linkStyle = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.BORDER_HI}`, color: t.ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none' };
  return (
    <section aria-label="Invitations published on the blog" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: '0 4px', fontSize: 12, color: t.MUTED }}>Published on the blog · showing {wall.from}–{wall.to} of {wall.total}</p>
      {wall.invites.map((card) => <OpenCard key={card.url} card={card} t={t} />)}
      {wall.pageCount > 1 ? (
        <nav aria-label="Invitation pages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {wall.page > 1 ? <Link href={pageHref(wall.page - 1, handle)} style={linkStyle}>Previous</Link> : <span />}
          <span style={{ fontSize: 12, color: t.MUTED }}>Page {wall.page} of {wall.pageCount}</span>
          {wall.page < wall.pageCount ? <Link href={pageHref(wall.page + 1, handle)} style={linkStyle}>Next</Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}

// The private invitations: name and opening only, blurred, with the sign-in ask over them.
function LockedWall({ data, t, signInUrl, verifyUrl }: { data: PublicInvites; t: DirectoryTokens; signInUrl: string; verifyUrl?: string }) {
  if (data.lockedCount === 0) return null;
  const more = data.lockedCount === 1 ? '1 more invitation is' : `${data.lockedCount.toLocaleString('en-US')} more invitations are`;
  return (
    <section aria-label="Invitations visible after signing in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: '0 4px', fontSize: 14, fontWeight: 700, color: t.TITLE }}>{more} visible once you sign in, free.</p>
      <div style={{ position: 'relative', minHeight: 240 }}>
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6 }}>
          {data.lockedTeasers.map((teaser, index) => <CondensedCard key={index} card={teaser} t={t} />)}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 48, gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', color: t.TITLE }}>Sign in to read the invitations</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </section>
  );
}

function Invitations({ data, error, t, signInUrl, verifyUrl, handle }: { data: PublicInvites | null; error: string | null; t: DirectoryTokens; signInUrl: string; verifyUrl?: string; handle?: string }) {
  if (error) return <div role="alert" style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>;
  if (!data) return <div role="status" style={{ fontSize: 13, color: t.MUTED }}>Loading the invitations…</div>;
  if (data.openWall.total === 0 && data.lockedCount === 0) return <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE }}>No invitations have been written yet.</p>;
  return (
    <>
      <OpenWall wall={data.openWall} t={t} handle={handle} />
      <LockedWall data={data} t={t} signInUrl={signInUrl} verifyUrl={verifyUrl} />
    </>
  );
}

/**
 * Signed-out visitor view for Directory (owner decision, 2026-10-15): how many people are listed, the
 * ask to sign in free and claim a listing or make one, then the invitations. Those already published
 * on the blog are readable here, picture included, each linking to its post; the private ones show
 * as a blurred wall carrying only each person's name and the opening words. Everything comes from
 * GET /api/directory/invites/public.
 */
export function DirectoryPublicShell({ signInUrl, verifyUrl, inviteHandle, signUpUrl, page = 1 }: DirectoryPublicShellProps) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  const { data, error } = usePublicInvites(inviteHandle, page);
  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY, color: t.TITLE }}>
      <div style={{ padding: '20px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShellBackLink />
          <BookOpen size={20} color={t.ACCENT} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Directory</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, background: t.ACCENT + '20', border: `1px solid ${t.ACCENT}40`, fontSize: 11, color: t.ACCENT, fontWeight: 600, width: 'fit-content' }}>Community members</span>
        <p style={{ margin: 0, fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>Therapists, housing navigators, legal advocates, and more — searchable by location and specialty.</p>
        {data ? <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.TITLE }}>{data.listed.toLocaleString('en-US')} {data.listed === 1 ? 'person' : 'people'} listed</p> : null}
        <PublicShellWorldwide color={t.MUTED} />
        <Pitch t={t} signInUrl={signInUrl} signUpUrl={signUpUrl} verifyUrl={verifyUrl} />
        <FeaturedInvite handle={inviteHandle} data={data} t={t} />
      </div>
      <div style={{ flex: 1, padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: '4px 4px 0', fontSize: 14, fontWeight: 700, color: t.SUBTLE }}>Invitations</h2>
        <Invitations data={data} error={error} t={t} signInUrl={signInUrl} verifyUrl={verifyUrl} handle={inviteHandle} />
      </div>
    </div>
  );
}
