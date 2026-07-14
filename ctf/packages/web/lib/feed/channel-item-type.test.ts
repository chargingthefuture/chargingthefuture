import { describe, it, expect } from 'vitest';
import { FEED_ALLOWED_CHANNELS, FEED_CHANNEL_TO_ITEM_TYPE } from './constants';
import type { FeedItemType } from './types';

// The Commons regression this guards: enabled-channel names are plural ('announcements') while the
// stored feed_items.item_type is singular ('announcement'). The feed timeline filters rows by
// item_type, so a channel name must be mapped through FEED_CHANNEL_TO_ITEM_TYPE first. Before the
// map existed the plural 'announcements' channel never matched the singular 'announcement' rows and
// announcements (and questions) silently vanished from the Commons.

const KNOWN_ITEM_TYPES: FeedItemType[] = ['announcement', 'question', 'community'];

describe('FEED_CHANNEL_TO_ITEM_TYPE', () => {
  it('maps every allowed channel to a known item type', () => {
    for (const channel of FEED_ALLOWED_CHANNELS) {
      expect(KNOWN_ITEM_TYPES).toContain(FEED_CHANNEL_TO_ITEM_TYPE[channel]);
    }
  });

  it('bridges the plural channel name to its singular item type', () => {
    expect(FEED_CHANNEL_TO_ITEM_TYPE.announcements).toBe('announcement');
    expect(FEED_CHANNEL_TO_ITEM_TYPE.questions).toBe('question');
    expect(FEED_CHANNEL_TO_ITEM_TYPE.community).toBe('community');
  });

  it('covers exactly the allowed channels', () => {
    expect(Object.keys(FEED_CHANNEL_TO_ITEM_TYPE).sort()).toEqual([...FEED_ALLOWED_CHANNELS].sort());
  });
});
