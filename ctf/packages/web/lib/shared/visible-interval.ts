// Run `tick` every `intervalMs`, but only while the tab is visible. A tab in the background skips its
// ticks, and the moment it becomes visible again `tick` runs once so the screen catches up at once.
//
// Why: ctf-web pays for every byte it sends, and a background tab that polls every 10-30s keeps paying
// for answers nobody is looking at — plus the database queries behind each one. Nothing is lost by
// pausing: no poll here drives a sound, a system notification, or the tab title, so the member sees
// exactly the same screen when they come back.
//
// Returns a function that stops the interval and removes the listener.
export function startVisibleInterval(tick: () => void, intervalMs: number): () => void {
  const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const intervalId = setInterval(() => {
    if (!isHidden()) tick();
  }, intervalMs);
  const onVisibility = () => {
    if (!isHidden()) tick();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    clearInterval(intervalId);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
