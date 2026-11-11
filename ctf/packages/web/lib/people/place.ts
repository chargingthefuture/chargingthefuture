// A person's place on People: the state or region and the country, never a street or a city. The
// Directory stores the country as its plain name ("United States"); the board shows the two-letter
// code ("Georgia, US"), so the name is turned into its code here, and kept as it is when it has none.

const ALIASES: Record<string, string> = {
  'cabo verde': 'CV',
  'congo (brazzaville)': 'CG',
  'congo (kinshasa)': 'CD',
  "cote d'ivoire": 'CI',
  "côte d'ivoire": 'CI',
  'usa': 'US',
  'united states of america': 'US',
  'uk': 'GB',
};

let codes: Map<string, string> | null = null;

// Every two-letter region code the runtime knows, by its English name, built once.
function countryCodes(): Map<string, string> {
  if (codes) return codes;
  const map = new Map<string, string>(Object.entries(ALIASES));
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of letters) {
    for (const b of letters) {
      const code = `${a}${b}`;
      const name = names.of(code);
      if (name && name !== code && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), code);
    }
  }
  codes = map;
  return map;
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/ and /g, ' & ');
}

export function countryCode(country: string | null | undefined): string | null {
  const value = country?.trim();
  if (!value) return null;
  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const map = countryCodes();
  return map.get(value.toLowerCase()) ?? map.get(normalize(value)) ?? value;
}

export function regionName(region: string | null | undefined): string | null {
  const value = region?.trim();
  return value ? value : null;
}
