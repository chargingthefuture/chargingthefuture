// Guess a person's full name from their Quora profile link, so a scout who pastes the link does not
// also have to type the name. Most Quora profile addresses are the name itself:
//
//   https://www.quora.com/profile/farah-brunache  → "Farah Brunache"
//   https://www.quora.com/profile/Mary-T-I-1      → "Mary T I"
//   https://www.quora.com/profile/TJW-38          → "TJW"
//
// Quora adds a number to the end when the name is already taken, so trailing number parts are
// dropped. Only letters and spaces survive, because that is all the Full Name field accepts. A word
// typed all in lowercase gets a capital first letter; any other casing is kept as the person chose it.
//
// Returns null when the link is not a Quora profile or nothing name-like is left, so the caller
// leaves the name field alone. It is only a guess the scout can edit before submitting.
export function nameFromQuoraProfileUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'quora.com' && !host.endsWith('.quora.com')) return null;

  const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
  if (segments.length < 2 || segments[0].toLowerCase() !== 'profile') return null;

  let slug: string;
  try {
    slug = decodeURIComponent(segments[1]);
  } catch {
    slug = segments[1];
  }

  const words = slug
    .split('-')
    .map((word) => word.replace(/[^a-zA-Z]/g, ''))
    .filter((word) => word.length > 0)
    .map((word) => (word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word));

  const name = words.join(' ').slice(0, 100).trim();
  return name.length >= 2 ? name : null;
}
