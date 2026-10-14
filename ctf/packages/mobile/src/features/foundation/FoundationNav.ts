// Opens the app's Recurring Activity screen from inside Foundation ("See your ongoing arrangements");
// back from it returns to Foundation.
import { createContext, useContext } from 'react';

export const FoundationNavContext = createContext<{ openRecurring: () => void } | null>(null);

export function useFoundationNav() {
  return useContext(FoundationNavContext);
}
