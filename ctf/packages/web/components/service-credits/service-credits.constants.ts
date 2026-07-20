// How members actually get ServiceCredits (owner-confirmed model, 2026-06-19).
//
// The platform itself only funds a few rewards. Everything else is peer-to-peer: you earn the same
// way you spend — by being paid by another member for a service or good. The earlier list (Peer
// Programming +500, Verify Provider +50, Referral +100, GentlePulse streak +150) overstated what the
// operator pays out and was removed.
export const PLATFORM_EARN_METHODS: {
  title: string;
  detail: string;
  credits: string;
  note: string;
  color: string;
  href: string | null;
}[] = [
  {
    title: 'Verify your account',
    detail: 'Add your Quora profile so we can confirm you are a real person.',
    credits: '+100',
    note: 'one-time',
    color: '#22C55E',
    href: '/plugin/unlock',
  },
  {
    // Peer-to-peer receipts are the main ongoing way to earn (owner addition, 2026-07-19): every
    // exchange where another member sends you credits for real help counts.
    title: 'Help another member',
    detail: 'Provide a service or good — housing, transport, skills, requests — and the member sends you credits.',
    credits: 'Per exchange',
    note: 'ongoing',
    color: '#38BDF8',
    href: '/apps/directory',
  },
  {
    title: 'Take part in SkillsHunt',
    detail: 'Earn credits by competing in SkillsHunt rounds.',
    credits: 'Per round',
    note: 'ongoing',
    color: '#FBBF24',
    href: '/apps/skills-hunt',
  },
  {
    title: 'Contribute during a fundraiser',
    detail: 'Pitch in when the community runs a fundraiser. The next one starts in July.',
    credits: 'Varies',
    note: 'seasonal',
    color: '#A855F7',
    href: null,
  },
];

// Where credits change hands between members. You earn here as the provider and spend here as the
// buyer — the same transactions, both directions — so this is both how you earn (beyond the platform
// rewards above) and where you spend.
export const PEER_TO_PEER_AREAS: { title: string; role: string; icon: string; color: string }[] = [
  // "send credits" phrasing, never "pay" — credits are a non-fiat internal unit (ctf/docs/DISCLAIMER.md).
  { title: 'Housing — LightHouse', role: 'Host a place / send credits to a host', icon: '🏠', color: '#60A5FA' },
  { title: 'Transport — TrustTransport', role: 'Give rides / send credits to a driver', icon: '📦', color: '#38BDF8' },
  { title: 'Services — Directory & Foundation', role: 'Offer your skills / exchange credits for help', icon: '🪛', color: '#F59E0B' },
  { title: 'Requests — SocketRelay', role: 'Fulfill requests / ask for help', icon: '🔂', color: '#FB923C' },
];
