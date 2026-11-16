import { describe, expect, it } from 'vitest';
import { SE_ME_VIEWS, SE_TRUST_SELF_PATH, isSeMeView, seTrustLineDate, seTrustLineText, seTrustPath, seTrustViewFrom } from '@ctf/shared';

describe('seTrustViewFrom', () => {
  it('reads the self answer as the full list', () => {
    const view = seTrustViewFrom({ userId: 'u', updatedAt: 'x', trustEvidence: [{ type: 'engagement-login-frequency', summary: 'Active on 3 days', details: 'Last sign-in', createdAt: '2026-11-01T00:00:00Z' }] });
    expect(view).toEqual({ disclosure: 'full', evidence: [{ type: 'engagement-login-frequency', summary: 'Active on 3 days', details: 'Last sign-in', createdAt: '2026-11-01T00:00:00Z' }] });
  });

  it('reads the summary another member gets and drops malformed lines', () => {
    const view = seTrustViewFrom({ trustDisclosure: 'summary', trustEvidence: [{ type: 'a', summary: 'One' }, { summary: 'no type' }, null, { type: 'b', summary: 'Two', details: '  ' }] });
    expect(view).toEqual({ disclosure: 'summary', evidence: [{ type: 'a', summary: 'One' }, { type: 'b', summary: 'Two' }] });
  });

  it('is null for anything that is not a trust answer', () => {
    expect(seTrustViewFrom(null)).toBeNull();
    expect(seTrustViewFrom({ ok: false, message: 'no' })).toBeNull();
  });
});

describe('trust lines', () => {
  it('falls back to a readable type when a line has no summary', () => {
    expect(seTrustLineText({ type: 'engagement-login-streak', summary: ' ' })).toBe('Engagement login streak');
    expect(seTrustLineText({ type: '', summary: '' })).toBe('Trust signal');
  });

  it('shows a date only when the line carries a real one', () => {
    expect(seTrustLineDate({ type: 'a', summary: 'x' })).toBeNull();
    expect(seTrustLineDate({ type: 'a', summary: 'x', createdAt: 'not a date' })).toBeNull();
    expect(seTrustLineDate({ type: 'a', summary: 'x', createdAt: '2026-11-01T12:00:00Z' })).toEqual(expect.any(String));
  });

  it('reads the member own trust through the self route and anybody else by id', () => {
    expect(seTrustPath('abc', true)).toBe(SE_TRUST_SELF_PATH);
    expect(seTrustPath('a b', false)).toBe('/api/trust/user/a%20b');
  });

  it('opens Trust in place from Me', () => {
    expect(SE_ME_VIEWS).toContain('trust');
    expect(isSeMeView('trust')).toBe(true);
  });
});
