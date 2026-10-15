'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, Lock } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { getDirectoryTokens, onAccentText, type DirectoryTokens } from './shared';
import { PublicShellWorldwide } from '@/components/plugins/public-shell-worldwide';
import { INVITE_WALL_WHY, type InviteCard, type PublicInvites } from './directory-invite-format';
import { INVITE_LINK_CLASS, InviteCardView } from './directory-invite-card';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";
const LOAD_ERROR = 'Could not load the invitations.';

type DirectoryPublicShellProps = PublicVisitorShellProps & {
  // The invite code from a direct link (/apps/directory?invite=<code>): that person's card shows on top.
  inviteCode?: string;
  // The page of the open (already public) invitations, from ?page= in the address.
  page?: number;
};

function usePublicInvites(inviteCode: string | undefined, page: number) {
  const [data, setData] = useState<PublicInvites | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (inviteCode) params.set('invite', inviteCode);
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
  }, [inviteCode, page]);
  return { data, error };
}

function BlogLink({ href, t }: { href: string; t: DirectoryTokens }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={INVITE_LINK_CLASS} style={{ fontSize: 13, fontWeight: 600, color: t.ACCENT }}>Read the invitation</a>;
}

// A private invite as a visitor may see it: name and opening words. A public one adds its blog link.
function CondensedCard({ card, t }: { card: InviteCard; t: DirectoryTokens }) {
  return (
    <InviteCardView name={card.name} opening={card.opening} date={card.date} t={t}>
      {card.blogUrl ? <BlogLink href={card.blogUrl} t={t} /> : null}
    </InviteCardView>
  );
}

// A blurred card behind the sign-in ask: an empty avatar circle and gray bars where the title and
// the opening words would be. It is drawn here and carries nothing from any invitation.
function PlaceholderCard({ t }: { t: DirectoryTokens }) {
  const bar = (width: string, height: number) => <span style={{ display: 'block', width, height, borderRadius: height / 2, background: t.BORDER_HI }} />;
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${t.BORDER_HI}`, background: t.SURFACE, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', background: t.BORDER_HI }} />
        {bar('55%', 12)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bar('100%', 10)}
        {bar('75%', 10)}
      </div>
    </div>
  );
}

const PLACEHOLDER_CARDS = [0, 1, 2] as const;

function Pitch({ t, signInUrl, verifyUrl }: { t: DirectoryTokens; signInUrl: string; verifyUrl?: string }) {
  if (verifyUrl) {
    return (
      <a href={verifyUrl} style={{ padding: '14px', borderRadius: 12, background: t.ACCENT, color: onAccentText(t), fontSize: 15, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Finish verifying</a>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE, lineHeight: 1.55 }}>Sign in free to read every invitation. Sign up to add yourself.</p>
      <a href={signInUrl} style={{ padding: '12px', borderRadius: 12, background: t.ACCENT, color: onAccentText(t), fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Sign in or create a free account</a>
    </div>
  );
}

function FeaturedInvite({ code, data, t }: { code?: string; data: PublicInvites | null; t: DirectoryTokens }) {
  if (!code || !data) return null;
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

function pageHref(page: number, code: string | undefined): string {
  const params = new URLSearchParams({ page: String(page) });
  if (code) params.set('invite', code);
  return `/apps/directory?${params.toString()}`;
}

// The invites already published on the blog, ten a page with the page number in the address.
function OpenWall({ wall, t, code }: { wall: PublicInvites['openWall']; t: DirectoryTokens; code?: string }) {
  if (wall.total === 0) return null;
  const linkStyle = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.BORDER_HI}`, color: t.ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none' };
  return (
    <section aria-label="Invitations published on the blog" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: '0 4px', fontSize: 12, color: t.MUTED }}>Published on the blog · showing {wall.from}–{wall.to} of {wall.total}</p>
      {wall.invites.map((card) => <CondensedCard key={card.url} card={card} t={t} />)}
      {wall.pageCount > 1 ? (
        <nav aria-label="Invitation pages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {wall.page > 1 ? <Link href={pageHref(wall.page - 1, code)} className={INVITE_LINK_CLASS} style={linkStyle}>Previous</Link> : <span />}
          <span style={{ fontSize: 12, color: t.MUTED }}>Page {wall.page} of {wall.pageCount}</span>
          {wall.page < wall.pageCount ? <Link href={pageHref(wall.page + 1, code)} className={INVITE_LINK_CLASS} style={linkStyle}>Next</Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}

// The private invitations: how many there are, over blurred placeholder cards with the sign-in ask.
// No name or opening words of a private invitation reach a signed-out visitor's page.
function LockedWall({ data, t, signInUrl, verifyUrl }: { data: PublicInvites; t: DirectoryTokens; signInUrl: string; verifyUrl?: string }) {
  if (data.lockedCount === 0) return null;
  const more = data.lockedCount === 1 ? '1 more invitation is' : `${data.lockedCount.toLocaleString('en-US')} more invitations are`;
  return (
    <section aria-label="Invitations visible after signing in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: '0 4px', fontSize: 14, fontWeight: 700, color: t.TITLE }}>{more} visible once you sign in, free.</p>
      <div style={{ position: 'relative', minHeight: 240 }}>
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10, filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6 }}>
          {PLACEHOLDER_CARDS.map((index) => <PlaceholderCard key={index} t={t} />)}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 48, gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${t.ACCENT}50`, background: t.BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={20} color={t.ACCENT} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', color: t.TITLE }}>Sign in to read the invitations</div>
          <a href={verifyUrl ?? signInUrl} style={{ padding: '10px 24px', borderRadius: 9, background: t.ACCENT, color: onAccentText(t), fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>{verifyUrl ? 'Finish verifying' : 'Sign in'}</a>
        </div>
      </div>
    </section>
  );
}

function Invitations({ data, error, t, signInUrl, verifyUrl, code }: { data: PublicInvites | null; error: string | null; t: DirectoryTokens; signInUrl: string; verifyUrl?: string; code?: string }) {
  if (error) return <div role="alert" style={{ fontSize: 13, color: '#EF4444' }}>{error}</div>;
  if (!data) return <div role="status" style={{ fontSize: 13, color: t.MUTED }}>Loading the invitations…</div>;
  if (data.openWall.total === 0 && data.lockedCount === 0) return <p style={{ margin: 0, fontSize: 13, color: t.SUBTLE }}>No invitations have been written yet.</p>;
  return (
    <>
      <OpenWall wall={data.openWall} t={t} code={code} />
      <LockedWall data={data} t={t} signInUrl={signInUrl} verifyUrl={verifyUrl} />
    </>
  );
}

/**
 * Signed-out visitor view for Directory (owner decision, 2026-10-15): how many people are listed, the
 * ask to sign in free and claim a listing or make one, then the invitations as cards (a decorative
 * avatar, the name, the date and the opening words). Those already published on the blog each link to
 * their post; the private ones show as a count over blurred placeholder cards that carry no names.
 * Everything comes from
 * GET /api/directory/invites/public.
 */
export function DirectoryPublicShell({ signInUrl, verifyUrl, inviteCode, page = 1 }: DirectoryPublicShellProps) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  const { data, error } = usePublicInvites(inviteCode, page);
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
        <Pitch t={t} signInUrl={signInUrl} verifyUrl={verifyUrl} />
        <FeaturedInvite code={inviteCode} data={data} t={t} />
      </div>
      <div style={{ flex: 1, padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: '4px 4px 0', fontSize: 14, fontWeight: 700, color: t.SUBTLE }}>Invitations</h2>
        <p style={{ margin: '0 4px', fontSize: 13, color: t.TEXT, lineHeight: 1.55 }}>{INVITE_WALL_WHY}</p>
        <Invitations data={data} error={error} t={t} signInUrl={signInUrl} verifyUrl={verifyUrl} code={inviteCode} />
      </div>
    </div>
  );
}
