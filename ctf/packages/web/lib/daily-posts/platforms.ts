// The places the owner posts to each day, in the order they work through them (owner request,
// 2026-11-10). `takes` says which piece of the day's content goes there. A platform added here
// gets its own row and tick on /admin/daily-posts; ticks are stored as `platform:<id>`.

export type DailyPlatformKind = 'post' | 'blurb' | 'live';

export type DailyPlatform = { id: string; label: string; kind: DailyPlatformKind; takes: string };

export const DAILY_PLATFORMS: DailyPlatform[] = [
  { id: 'quora', label: 'Quora', kind: 'post', takes: 'A blog post, pasted in full' },
  { id: 'substack', label: 'Substack', kind: 'post', takes: 'A blog post, pasted in full' },
  { id: 'medium', label: 'Medium', kind: 'post', takes: 'A blog post, pasted in full' },
  { id: 'commons', label: 'Commons announcement', kind: 'blurb', takes: 'A blurb' },
  { id: 'whatsapp', label: 'WhatsApp', kind: 'blurb', takes: 'A blurb' },
  { id: 'discord', label: 'Discord', kind: 'blurb', takes: 'A blurb' },
  { id: 'tiktok', label: 'TikTok', kind: 'live', takes: "Today's live topic, then a clip with a blurb" },
  { id: 'youtube', label: 'YouTube', kind: 'live', takes: "Today's live topic, then a clip" },
  { id: 'twitch', label: 'Twitch', kind: 'live', takes: "Today's live topic" },
  { id: 'signal', label: 'Signal', kind: 'live', takes: "Today's live topic" },
  { id: 'beacon', label: 'Beacon', kind: 'live', takes: "Today's live topic" },
];
