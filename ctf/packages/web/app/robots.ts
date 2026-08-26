import type { MetadataRoute } from 'next';

// Crawler policy for the web app. The public marketing shells (the signed-out home and the
// per-plugin landing pages) are meant to be crawled, so the root stays open. Everything a
// crawler has no business fetching is disallowed: the API surface, the admin surface, the
// signed-in account area, and the plugin runtime pages. Served by Next.js at /robots.txt.
// No sitemap reference — the app has no sitemap route today.
//
// Quora's link-preview fetcher is barred outright (owner-directed follow-up to the sharing-tag
// removal in layout.tsx). When a member pastes an app address into a Quora post, Quora fetches
// the page and rewrites the pasted address into the page title; with the openGraph and twitter
// tags gone it falls back to the <title> tag, so the rewrite survived that removal. The title
// cannot go — it names the browser tab and is what a screen reader announces — so instead the
// fetcher is denied the page: a preview bot that cannot fetch leaves the address as typed.
// Search engines are unaffected; only Quora's agent is named.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['Quora-Bot', 'QuoraBot', 'Quora Link Preview'],
        disallow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/account', '/plugin/'],
      },
    ],
  };
}
