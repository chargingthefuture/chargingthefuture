// Browser storage for the Commons' small per-visitor settings: the @comic consent flag, the apps
// list's sort mode, recent apps and usage counts. When the browser blocks site data (private modes,
// "block all cookies", managed browsers) any touch of localStorage throws, and a write can also throw
// when storage is full. Before these helpers that throw took the Commons down on load and stopped the
// "Open plugin" link from navigating. Now a blocked read returns null and a blocked write does
// nothing, so the setting holds in memory for this visit only.

export function readStoredValue(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredValue(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: the value stays in memory for this visit.
  }
}
