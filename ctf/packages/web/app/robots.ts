import type { MetadataRoute } from 'next';

// Crawler policy for the web app. The public marketing shells (the signed-out home and the
// per-plugin landing pages) are meant to be crawled, so the root stays open. Everything a
// crawler has no business fetching is disallowed: the API surface, the admin surface, the
// signed-in account area, and the plugin runtime pages. Served by Next.js at /robots.txt.
// No sitemap reference — the app has no sitemap route today.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/account', '/plugin/'],
      },
    ],
  };
}
