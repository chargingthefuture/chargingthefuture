import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { shareCardForRequest } from '@/lib/seo/share-card-request';

// Each page's link card is titled with its own address (lib/seo/share-card.ts).
export async function generateMetadata(): Promise<Metadata> {
  return shareCardForRequest();
}

/**
 * Wraps every routed `/plugin/*` screen in the shared app viewport so plugin
 * shells reflow to a single scrolling column on phones. On desktop it is an
 * inert full-width wrapper. See `.ctf-app-viewport` in `globals.css`.
 */
export default function PluginLayout({ children }: { children: ReactNode }) {
  return <div className="ctf-app-viewport">{children}</div>;
}
