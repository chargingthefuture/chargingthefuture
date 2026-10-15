import { describe, expect, it } from 'vitest';
import { INVITE_MAX, normalizeInviteHandle, parseDirectoryInviteInput, quoraHandleFromUrl } from './invite-input';

// The checks on what the private invite repository's job sends. Each refusal must name the field,
// because the job's log is the only place anybody reads it.

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]).toString('base64');

function body(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'an-invitation-to-sam',
    quoraHandle: 'Sam-Example-1',
    quoraUrl: 'https://www.quora.com/profile/Sam-Example-1',
    name: 'Sam',
    title: 'An invitation to Sam',
    opening: 'Sam fixes bicycles.',
    bodyMarkdown: 'Sam fixes bicycles.\n\nMore text.',
    publishedOn: '2026-10-15',
    ...overrides,
  };
}

describe('parseDirectoryInviteInput', () => {
  it('accepts a complete invite and lower-cases the handle, keeping the address as sent', () => {
    const result = parseDirectoryInviteInput(body());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.quoraHandle).toBe('sam-example-1');
      expect(result.value.quoraUrl).toBe('https://www.quora.com/profile/Sam-Example-1');
      expect(result.value.directoryProfileId).toBeNull();
      expect(result.value.image).toBeNull();
    }
  });

  it.each([
    ['slug', { slug: 'Has Spaces' }],
    ['quoraHandle', { quoraHandle: '' }],
    ['quoraUrl', { quoraUrl: 'http://www.quora.com/profile/Sam-Example-1' }],
    ['quoraUrl', { quoraUrl: 'https://example.com/profile/Sam-Example-1' }],
    ['quoraHandle', { quoraHandle: 'someone-else' }],
    ['name', { name: '   ' }],
    ['opening', { opening: 'x'.repeat(INVITE_MAX.opening + 1) }],
    ['bodyMarkdown', { bodyMarkdown: 42 }],
    ['publishedOn', { publishedOn: '15/10/2026' }],
    ['publishedOn', { publishedOn: '2026-02-30' }],
    ['directoryProfileId', { directoryProfileId: 'not an id!' }],
  ])('refuses a bad %s and names it', (field, overrides) => {
    const result = parseDirectoryInviteInput(body(overrides));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe(field);
      expect(result.message.startsWith(`${field}:`)).toBe(true);
    }
  });

  it('refuses a body that is not an object', () => {
    expect(parseDirectoryInviteInput([]).ok).toBe(false);
    expect(parseDirectoryInviteInput(null).ok).toBe(false);
  });

  it('accepts a picture whose declared type matches its bytes, and needs alt text', () => {
    const ok = parseDirectoryInviteInput(body({ image: { data: PNG, type: 'image/png', alt: 'What Sam wrote.' } }));
    expect(ok.ok && ok.value.image?.contentType).toBe('image/png');

    const noAlt = parseDirectoryInviteInput(body({ image: { data: PNG, type: 'image/png', alt: '' } }));
    expect(!noAlt.ok && noAlt.field).toBe('image.alt');
  });

  it('refuses a picture whose declared type disagrees with its bytes, or that is not a picture', () => {
    const wrongType = parseDirectoryInviteInput(body({ image: { data: JPEG, type: 'image/png', alt: 'a' } }));
    expect(!wrongType.ok && wrongType.field).toBe('image.type');

    const notPicture = parseDirectoryInviteInput(body({ image: { data: Buffer.from('<svg/>').toString('base64'), type: 'image/png', alt: 'a' } }));
    expect(!notPicture.ok && notPicture.field).toBe('image.data');

    const notBase64 = parseDirectoryInviteInput(body({ image: { data: '***', type: 'image/png', alt: 'a' } }));
    expect(!notBase64.ok && notBase64.field).toBe('image.data');
  });

  it('refuses a picture over the size limit before decoding it', () => {
    const huge = 'A'.repeat(Math.ceil((INVITE_MAX.imageBytes * 4) / 3) + 4096);
    const result = parseDirectoryInviteInput(body({ image: { data: huge, type: 'image/png', alt: 'a' } }));
    expect(!result.ok && result.field).toBe('image.data');
  });
});

describe('public invites', () => {
  it('defaults to private, and needs a blog address when public', () => {
    const plain = parseDirectoryInviteInput(body());
    expect(plain.ok && plain.value.isPublic).toBe(false);

    const missing = parseDirectoryInviteInput(body({ public: true }));
    expect(!missing.ok && missing.field).toBe('blogUrl');

    const ok = parseDirectoryInviteInput(body({ public: true, blogUrl: 'https://chargingthefuture.github.io/chargingthefuture/an-invitation-to-sam' }));
    expect(ok.ok && ok.value.isPublic && ok.value.blogUrl).toBe('https://chargingthefuture.github.io/chargingthefuture/an-invitation-to-sam');
  });

  it('accepts blog_url for the same value, and refuses a non-boolean public', () => {
    const snake = parseDirectoryInviteInput(body({ public: true, blog_url: 'https://example.org/post' }));
    expect(snake.ok && snake.value.blogUrl).toBe('https://example.org/post');

    const wrong = parseDirectoryInviteInput(body({ public: 'yes' }));
    expect(!wrong.ok && wrong.field).toBe('public');
  });
});

describe('handles', () => {
  it('reads the handle from a Quora address in either shape', () => {
    expect(quoraHandleFromUrl('https://www.quora.com/profile/Sam-Example-1/')).toBe('sam-example-1');
    expect(quoraHandleFromUrl('https://www.quora.com/profile/Sam-Example-1?ch=10')).toBe('sam-example-1');
    expect(quoraHandleFromUrl('https://www.quora.com/profile/Marko-Petrovi%C4%87-49')).toBe('marko-petrovi%c4%87-49');
  });

  it('normalizes the ?invite= value and refuses what could not be a handle', () => {
    expect(normalizeInviteHandle(' Farah-Brunache ')).toBe('farah-brunache');
    expect(normalizeInviteHandle('a/b')).toBeNull();
    expect(normalizeInviteHandle('jo%C3%A3o-louren%C3%A7o-16')).toBe('jo%c3%a3o-louren%c3%a7o-16');
    expect(normalizeInviteHandle('João-Lourenço-16')).toBe('jo%c3%a3o-louren%c3%a7o-16');
    expect(normalizeInviteHandle(undefined)).toBeNull();
    expect(normalizeInviteHandle(['farah-brunache'])).toBeNull();
  });
});
