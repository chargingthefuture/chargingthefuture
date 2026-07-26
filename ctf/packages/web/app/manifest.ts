import type { MetadataRoute } from 'next';

// Web app manifest (owner decision, 2026-07-20): make the web app a first-class installable PWA on
// Android and iOS. With this + the service worker (public/sw.js) + web push (already shipped), the
// mobile-responsive web app covers phones for the whole product; the native Android app is narrowed
// to Chyme (live audio). "Add to Home screen" then gives members a standalone app icon that opens
// the Commons in its own window — no browser chrome — and receives web push.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skills Economy',
    short_name: 'SE',
    description: 'A psyop-free economy: survivors exchanging real skills, help, and resources.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F1117',
    theme_color: '#0F1117',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
