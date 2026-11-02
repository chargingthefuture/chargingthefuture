import type { Metadata } from 'next';

// Link cards (owner decision, 2026-11-02). Quora, Facebook and Twitter title a pasted link from the
// page's Open Graph and Twitter tags, and fall back to the tab title when there are none. With no
// tags, every app link showed the tab title, so a post listing four parts of the app read as one
// sentence four times (the reason the tags were removed on 2026-08-25). Each page's card now
// carries its own address instead, lowercase as it is typed: app.lagatos.com/apps/directory. Four
// links read as four different places, and the tab title is unchanged.

export const SHARE_HOST = 'app.lagatos.com';

/** Set by middleware.ts on every request, so a layout can title the card from the address. */
export const PATHNAME_HEADER = 'x-ctf-pathname';

export function shareCardTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, '');
  return `${SHARE_HOST}${path}`;
}

export function shareCardMetadata(pathname: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  const title = shareCardTitle(pathname);
  return {
    openGraph: { type: 'website', siteName: SHARE_HOST, title, url: `https://${title}` },
    twitter: { card: 'summary', title },
  };
}
