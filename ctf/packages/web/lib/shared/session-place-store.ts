// sessionStorage for where a member was in the 3.1 app, so a reload of the page (iOS unloads a
// background tab to free memory) puts them back: unsent drafts (`se-draft:`) and the open Today card
// and scroll (`se-today-`). sessionStorage ends with the tab. A blocked or full store throws on any
// touch, so a read returns null and a write does nothing: the app then behaves as before, starting
// fresh on a reload.

export const SESSION_DRAFT_PREFIX = 'se-draft:';
export const SESSION_TODAY_PREFIX = 'se-today-';

export function readSessionPlace(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

// An empty or null value removes the key.
export function writeSessionPlace(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // no-trace: storage blocked (private browsing) or full is expected and runs on every keystroke;
    // the value stays in memory for this visit.
  }
}

// Nobody is signed in: drop every draft and the remembered Today place, so the next person to sign
// in on a shared phone in this tab never sees the last member's unsent text.
export function clearSessionPlaces(): void {
  try {
    if (typeof window === 'undefined') return;
    const store = window.sessionStorage;
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && (key.startsWith(SESSION_DRAFT_PREFIX) || key.startsWith(SESSION_TODAY_PREFIX))) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // no-trace: storage blocked (private browsing) is expected, and then nothing was saved in it.
  }
}
