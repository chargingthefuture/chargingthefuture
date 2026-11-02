// Lets a tab screen inside the 3.1 frame send the frame's scroll back to the top, as the web does
// with window.scrollTo when People turns a page.

import { createContext, useContext } from 'react';

export const SeFrameScrollContext = createContext<() => void>(() => undefined);

export function useScrollFrameToTop(): () => void {
  return useContext(SeFrameScrollContext);
}
