import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { shareCardForRequest } from '@/lib/seo/share-card-request';

// Each page's link card is titled with its own address (lib/seo/share-card.ts).
export async function generateMetadata(): Promise<Metadata> {
  return shareCardForRequest();
}

/**
 * Wraps every routed `/apps/*` screen in the shared app viewport. On phones this
 * lets each plugin shell's fixed desktop row fall back to a single scrolling
 * column (see `.ctf-app-viewport` in `globals.css`); on desktop it is an inert
 * full-width wrapper that changes nothing.
 */
export default function AppsLayout({ children }: { children: ReactNode }) {
  return <div className="ctf-app-viewport">{children}</div>;
}
