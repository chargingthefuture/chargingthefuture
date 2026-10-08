// Opens Recurring Activity from inside Foundation ("See your ongoing arrangements"), on top of whatever
// Foundation screen was open, so back returns there.
import { createContext, useContext } from 'react';

export const FoundationNavContext = createContext<{ openRecurring: () => void } | null>(null);

export function useFoundationNav() {
  return useContext(FoundationNavContext);
}
