import { canonicalizeQuoraUrl } from 'lib/shared/quora-url';

// What a scout pastes into the Quora field is not always a bare link. Owner report (2026-10-13): a
// batch of nominations was pasted with leftover text in front of the link and a profile tab after
// it, as `/br` on one line and `https://www.quora.com/profile/Swiftness-8/activity` on the next.
// The link itself is in there, and the tab (`/activity`, `/answers`, `/followers`, …) is a page of
// the same profile, so both are trimmed off rather than refused or stored as typed.
//
// This sits in front of lib/shared/quora-url.ts rather than inside it. Directory calls that function
// too and keeps any quora.com path, since a Directory link may point at something the person
// posted; a SkillsHunt nomination is always of a person, so only here does a profile tab collapse
// to the profile.

const FIRST_LINK_IN_TEXT = /https?:\/\/\S+/i;

// The first http(s) link in the text with any profile tab removed, or the trimmed text unchanged
// when there is no link to find.
export function extractQuoraProfileLink(value: string): string {
  const trimmed = value.trim();
  const link = trimmed.match(FIRST_LINK_IN_TEXT)?.[0] ?? trimmed;

  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    return trimmed;
  }

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length > 2 && segments[0].toLowerCase() === 'profile') {
    return `${parsed.protocol}//${parsed.host}/profile/${segments[1]}`;
  }
  return link;
}

// The nomination's identity: the canonical form of the profile link found in what was pasted.
export function canonicalizeNominationUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  return canonicalizeQuoraUrl(extractQuoraProfileLink(value));
}
