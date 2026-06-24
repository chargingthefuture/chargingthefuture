// Policy logic for PeerProgramming plugin
// Placeholder for access control, role checks, etc.
import { Cohort } from './types';
export function canJoinCohort(userId: string, cohort: Cohort): boolean {
  // TODO: Implement real policy logic
  return cohort.joinable;
}
