// API client for Peer Programming plugin (mobile)
// This will be replaced with real endpoints when available.

export async function fetchCohorts(_authToken: string) {
  // TODO: Replace with real API endpoint
  // Example: GET /api/peer-programming/cohorts
  // Pass authToken in headers if required
  return [
    { id: 1, name: 'Tech for Good — Week 4', facilitator: 'Lena H.', time: 'Tues 7 PM UTC', members: 12, maxMembers: 12, status: 'active', skills: ['React', 'Node.js'], countries: ['🇺🇸','🇳🇬','🇧🇷','🇮🇳'], joinable: false },
    { id: 2, name: 'Business Basics — Week 2', facilitator: 'James T.', time: 'Wed 6 PM UTC', members: 9, maxMembers: 12, status: 'active', skills: ['Accounting', 'Marketing'], countries: ['🇺🇸','🇬🇭','🇺🇬'], joinable: true },
    { id: 3, name: 'Creative Economy Cohort', facilitator: 'Amara O.', time: 'Thurs 8 PM UTC', members: 7, maxMembers: 12, status: 'forming', skills: ['Design', 'Content'], countries: ['🇺🇸','🇰🇪','🇦🇺'], joinable: true },
  ];
}
