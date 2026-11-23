// Usernames for the synthetic helper accounts the demo seed writes (ctf/scripts/demo-seed/). They
// have no Clerk account, so resolveUsernames finds no handle for them and a card showed the
// generated `user-demo-pee` instead. These ids exist only in the demo schema; a real account id never
// matches one. Every name here is approved by the owner before it ships: never add one without that
// approval (CLAUDE.md, Demo data names).
export const DEMO_HELPER_USERNAMES: Readonly<Record<string, string>> = {
  'demo-peer-foundation-01': 'saya_r',
  'demo-peer-foundation-02': 'jon_b',
  'demo-peer-foundation-03': 'lena_k',
  'demo-peer-lighthouse-01': 'sam_t',
  'demo-peer-lighthouse-02': 'dee_w',
  'demo-peer-lighthouse-03': 'tombe_p',
};

export function demoHelperUsername(userId: string): string | null {
  return Object.prototype.hasOwnProperty.call(DEMO_HELPER_USERNAMES, userId) ? DEMO_HELPER_USERNAMES[userId] : null;
}
