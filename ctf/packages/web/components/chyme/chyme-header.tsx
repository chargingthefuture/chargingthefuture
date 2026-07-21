'use client';

// The app ships a single phone-width layout at every viewport. On phones the
// brand, Live badge, and participant count duplicate the page's top nav and the
// room card just below, and the refresh control moves onto the Join Room line
// (see ChymeSidebar), so the whole header row is dropped — this component always
// renders nothing.
// Props are accepted only to keep a stable call signature; the header renders
// nothing, so they are intentionally unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ChymeHeader(_props: {
  participantCount: number;
  isLive: boolean;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return null;
}
