// Types for PeerProgramming plugin
export interface Cohort {
  id: string;
  name: string;
  facilitator: string;
  time: string;
  members: number;
  maxMembers: number;
  status: 'active' | 'forming';
  skills: string[];
  countries: string[];
  joinable: boolean;
}
// ...add more as needed
