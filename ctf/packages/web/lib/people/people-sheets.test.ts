import { describe, expect, it } from 'vitest';
import {
  seFoundationFailure,
  sePersonLinks,
  sePersonProfileFrom,
  sePersonSheetPath,
  seQuoteProviderFrom,
  seQuoteServiceType,
  seOwnProfileIdFrom,
  seWebAddress,
  type SePerson,
} from '@ctf/shared';

const person: SePerson = {
  id: 'p1',
  name: 'Teodor Braskwell',
  headline: null,
  jobTitle: 'Career coach',
  claimed: true,
  region: 'Georgia',
  country: 'US',
  offering: ['Resume writing'],
  listed: [],
  profileUrl: 'https://www.quora.com/profile/Teodor-Braskwell',
};

describe('People rows and sheets, shared by web and Android', () => {
  it('offers the Quora profile only for a web address, and a quote only to somebody offering a skill', () => {
    expect(sePersonLinks(person)).toEqual({ quora: person.profileUrl, canQuote: true });
    expect(sePersonLinks({ ...person, offering: [], profileUrl: 'javascript:alert(1)' })).toEqual({ quora: null, canQuote: false });
    expect(seWebAddress('  ')).toBeNull();
    expect(seWebAddress(' http://example.org/a ')).toBe('http://example.org/a');
  });

  it('reads the Directory profile without the city', () => {
    const profile = sePersonProfileFrom({
      member: {
        id: 'p1',
        name: 'Teodor Braskwell',
        city: 'Atlanta',
        state: 'Georgia',
        country: 'US',
        skills: ['Public speaking', ''],
        pendingSkills: ['Mentoring'],
        claimedByUserId: null,
        source: 'community-generated',
        invitedByUsername: 'scout',
        hasWeaversBadge: true,
        profileUrl: 'https://www.quora.com/profile/T',
      },
    });
    expect(profile?.place).toBe('Georgia, US');
    expect(profile?.skills).toEqual(['Public speaking']);
    expect(profile?.communityGenerated).toBe(true);
    expect(profile?.weavers).toBe(false);
    expect(profile?.quora).toBe('https://www.quora.com/profile/T');
    expect(sePersonProfileFrom({ ok: false })).toBeNull();
  });

  it('reads the Foundation provider and names the service as the Foundation screens do', () => {
    const read = seQuoteProviderFrom({
      viewerUserId: 'u2',
      provider: { profileId: 'p1', providerUserId: 'u1', displayName: 'Teodor', headline: ' Coach ', offeredSkills: [{ id: 's', name: 'Resume writing' }] },
    });
    expect(read?.viewerUserId).toBe('u2');
    expect(read?.provider.offeredSkills).toEqual(['Resume writing']);
    expect(seQuoteServiceType(read?.provider.headline ?? null)).toBe('Coach');
    expect(seQuoteServiceType(null)).toBe('General trade service');
    expect(seQuoteProviderFrom({ provider: { profileId: 'p1' } })).toBeNull();
  });

  it('says what failed, with the reference', () => {
    expect(seFoundationFailure({ code: 'FOUNDATION_POLICY_DENIED', reference: 'r1' }, 'x')).toBe("You can't request a quote from your own profile. [ref r1]");
    expect(seFoundationFailure({ message: 'Provider profile unavailable.' }, 'x')).toBe('Provider profile unavailable.');
    expect(seFoundationFailure(null, 'Could not submit the quote request.')).toBe('Could not submit the quote request.');
    expect(sePersonSheetPath('a b')).toBe('/?tab=people&person=a%20b');
    expect(seOwnProfileIdFrom({ profile: { id: 'p9' } })).toBe('p9');
    expect(seOwnProfileIdFrom({ profile: null })).toBeNull();
  });
});
