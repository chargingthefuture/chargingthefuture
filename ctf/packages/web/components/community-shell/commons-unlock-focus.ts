'use client';

import { createContext, useContext } from 'react';

// True while the Commons is showing a signed-in member who is not yet approved through Unlock.
//
// Owner decision, 2026-09-26: such a member sees the Commons stripped back to the verification banner
// and the chat. Every app, the Apps section and its sort and search, the plugin links under answers
// and announcements, and the locked contributor channel chip all lead to something they cannot use
// yet, and together they buried the one thing they need to do. It all returns on the first page load
// after they are approved. This reverses the earlier "nothing is hidden here" choice for this one
// group of members only; an approved member and a signed-out visitor see no change.
//
// Set once by CommunityShell from the server-resolved verification state and read deep in the tree
// (answer cards, announcement cards, the suggestion chips), so it is a context rather than a prop
// threaded through every layer between.
export const CommonsUnlockFocusContext = createContext(false);

export function useCommonsUnlockFocus(): boolean {
  return useContext(CommonsUnlockFocusContext);
}
