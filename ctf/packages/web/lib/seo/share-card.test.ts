import { describe, expect, it } from 'vitest';
import { shareCardMetadata, shareCardTitle } from './share-card';

describe('shareCardTitle', () => {
  it('is the address as typed, lowercase host, no trailing slash', () => {
    expect(shareCardTitle('/')).toBe('app.lagatos.com');
    expect(shareCardTitle('/apps/directory')).toBe('app.lagatos.com/apps/directory');
    expect(shareCardTitle('/guide/')).toBe('app.lagatos.com/guide');
  });

  it('puts the same title on both cards', () => {
    const card = shareCardMetadata('/knowledge');
    expect(card.openGraph?.title).toBe('app.lagatos.com/knowledge');
    expect(card.twitter && 'title' in card.twitter ? card.twitter.title : null).toBe('app.lagatos.com/knowledge');
  });
});
