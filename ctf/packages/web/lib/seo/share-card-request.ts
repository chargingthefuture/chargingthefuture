import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PATHNAME_HEADER, shareCardMetadata } from './share-card';

/** For a layout over dynamic pages: the card for whichever page is being served. */
export async function shareCardForRequest(): Promise<Pick<Metadata, 'openGraph' | 'twitter'>> {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? '/';
  return shareCardMetadata(pathname.startsWith('/') ? pathname : '/');
}
