// The Match card on signed-in Today (owner decision, 2026-11-16), shared by web and Android: what the
// member needs, as the need chips the landing page offers, and how many Directory people fit it.
// Built to the Match card on the approved Today board.

// What a member can say they need, and the Skills Taxonomy job titles (by name) that can help with
// each. This is the app's own copy of NEEDS in the landing page (chargingthefuture/landing-page,
// index.html, "const NEEDS"), so a need picked there and a need picked here mean the same people.
// When the landing page changes that list, change this one to match.
export type SeMatchNeed = { key: string; label: string; titles: readonly string[] };

export const SE_MATCH_NEEDS: readonly SeMatchNeed[] = [
  { key: 'job', label: 'A job', titles: ['Human Resources Professionals / HR Generalists', 'Vocational Trainers', 'Business Development Officers / SME Advisors', 'Community Development Officers', 'Management Consultants', 'Project Managers'] },
  { key: 'housing', label: 'Housing', titles: ['Property Managers', 'Construction Laborers', 'Masons', 'Electricians', 'Plumbers', 'Plumbers (construction)', 'HVAC / Insulation Technicians', 'Architects', 'Civil Engineers', 'Temporary Shelter & Logistics Staff'] },
  { key: 'food', label: 'Food', titles: ['Farmers', 'Food-Processing Workers', 'Chefs / Cooks', 'Agribusiness Managers'] },
  { key: 'health', label: 'Health care', titles: ['Nurses', 'Medical Assistants', 'Home Health Aides / Caregivers', 'General Practitioners', 'Specialists (e.g., cardiology, pediatrics)', 'Midwives', 'Pharmacists', 'Community-Health Workers', 'EMS / Paramedics'] },
  { key: 'talk', label: 'Someone to talk to', titles: ['Mental Health Counselors', 'Psychologists', 'Therapists', 'Social Workers'] },
  { key: 'kids', label: 'Childcare', titles: ['Childcare Workers', 'Early-Childhood Educators'] },
  { key: 'legal', label: 'Legal help', titles: ['Lawyers', 'Lawyers / Legal Consultants'] },
  { key: 'ride', label: 'A ride or a delivery', titles: ['Truck Drivers', 'Delivery Drivers / Couriers', 'Bus/Train Operators', 'Mechanics'] },
  { key: 'money', label: 'Finance and paperwork', titles: ['Accountants', 'Financial Analysts / Accountants', 'Financial Advisors', 'Financial Literacy Trainers', 'Microfinance Officers / Loan Officers', 'Administrative & Office Support'] },
  { key: 'learn', label: 'Learn something new', titles: ['Tutors', 'Vocational Trainers', 'Primary School Teachers', 'Secondary School Teachers', 'University Faculty', 'Financial Literacy Trainers'] },
  { key: 'career', label: 'Change careers', titles: ['Vocational Trainers', 'Human Resources Professionals / HR Generalists', 'Management Consultants', 'Business Development Officers / SME Advisors', 'Community Development Officers', 'Financial Literacy Trainers'] },
  { key: 'tech', label: 'Tech help', titles: ['Software Developers', 'Software Engineers / Developers', 'Web Developers', 'IT Support Technicians', 'Tech Support / DevOps'] },
  { key: 'business', label: 'To start a business', titles: ['Business Development Officers / SME Advisors', 'Marketing Specialists', 'Cooperative Managers', 'Market Linkage / Trade Facilitators', 'Social Media Managers', 'Graphic / Visual Designers'] },
  { key: 'been', label: "Answers from people who've been through it", titles: ['Advocates / Awareness Raisers'] },
  { key: 'voice', label: 'Someone to speak up for me', titles: ['Journalists / Reporters', 'PR & Communications Specialists'] },
  { key: 'care', label: 'Hair, repairs or cleaning', titles: ['Personal Services (hairdressers, repair)', 'Cleaners / Janitorial'] },
  { key: 'hands', label: 'Tools or a hand with a job', titles: ['Construction Laborers', 'Electricians', 'Plumbers', 'Masons', 'HVAC / Insulation Technicians', 'Maintenance Engineers', 'Maintenance Crews', 'Mechanics'] },
  { key: 'pass', label: "Pass on things I don't need", titles: ['Delivery Drivers / Couriers', 'Package Handlers / Warehouse Workers', 'Supply Managers', 'Truck Drivers'] },
  { key: 'harass', label: "Harassment that won't stop", titles: ['Cybersecurity Specialists', 'IT Security Specialists', 'Network Engineers', 'Lawyers', 'Lawyers / Legal Consultants'] },
  { key: 'record', label: 'Keep a record of what happened', titles: ['Lawyers', 'Lawyers / Legal Consultants', 'Journalists / Reporters', 'Forensic Staff', 'Advocates / Awareness Raisers'] },
];

// What GET /api/today/match answers. `needs` is null until the member has picked something;
// `count` is how many Directory people fit, counted live on every read, null when it could not be
// counted.
export type SeMatchNeeds = { needKeys: string[]; jobTitleIds: string[] };
export type SeMatchState = { needs: SeMatchNeeds | null; count: number | null };

// The body of PUT /api/today/match: the picked needs by key, or a code saved on the landing page.
export type SeMatchChange = { kind: 'needs'; needKeys: string[] } | { kind: 'code'; code: string };

// The 30 letters and numbers the landing page writes its codes in.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

// A landing page code as it is stored ("ABCDE-FGHJK"), whatever spacing, dashes or case it was typed
// in, or null when it is not 10 of those letters and numbers. The same rule as the landing page.
export function seMatchCode(raw: unknown): string | null {
  const value = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (value.length !== 10 || [...value].some((ch) => !CODE_ALPHABET.includes(ch))) return null;
  return `${value.slice(0, 5)}-${value.slice(5)}`;
}

// The known need keys out of a list, once each, in the list's own order.
export function seMatchNeedKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(SE_MATCH_NEEDS.map((need) => need.key));
  return [...new Set(raw.filter((key): key is string => typeof key === 'string' && known.has(key)))];
}

// Reads a PUT body: `{ needs: [...] }` with at least one known need, or `{ code }` in the code's shape.
export function seParseMatchChange(body: unknown): SeMatchChange | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as { needs?: unknown; code?: unknown };
  if (value.code !== undefined) {
    const code = seMatchCode(value.code);
    return code ? { kind: 'code', code } : null;
  }
  const needKeys = seMatchNeedKeys(value.needs);
  return needKeys.length > 0 ? { kind: 'needs', needKeys } : null;
}

// The job title names behind some needs, once each.
export function seMatchTitleNames(needKeys: readonly string[]): string[] {
  const names = SE_MATCH_NEEDS.filter((need) => needKeys.includes(need.key)).flatMap((need) => need.titles);
  return [...new Set(names)];
}

// The needs a set of job titles covers in full, the way the landing page puts a saved code back on
// its chips. `idsByName` maps a job title's name to its ids.
export function seMatchNeedsCovered(jobTitleIds: readonly string[], idsByName: ReadonlyMap<string, readonly string[]>): string[] {
  const held = new Set(jobTitleIds);
  return SE_MATCH_NEEDS.filter((need) => {
    const ids = need.titles.flatMap((name) => idsByName.get(name) ?? []);
    return ids.length > 0 && ids.every((id) => held.has(id));
  }).map((need) => need.key);
}

export const SE_MATCH_WORDS = {
  label: 'Match',
  fit: (count: number) => (count === 1 ? 'person fits what you need' : 'people fit what you need'),
  introduce: 'See who fits',
  ask: 'What do you need today?',
  needsLabel: 'What you need',
  show: 'Show who fits',
  saving: 'Saving…',
  change: 'Change what you need',
  cancel: 'Keep what I had',
  codeLabel: 'Have a code from lagatos.com?',
  codePlaceholder: 'ABCDE-FGHJK',
  useCode: 'Use code',
  badCode: 'A code is 10 letters and numbers, like ABCDE-FGHJK.',
  loading: 'Counting…',
  failed: 'Could not read Match.',
  notSaved: 'Not saved.',
  tryAgain: 'Try again',
  noCount: 'The count could not be read just now.',
};
