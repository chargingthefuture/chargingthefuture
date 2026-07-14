'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type CSSProperties } from 'react';

/**
 * Shared refresh control for web plugin shells. The installed web app (standalone display mode)
 * disables the browser's built-in pull-to-refresh, so a member has no way to re-pull data without
 * closing and reopening the app — this button is the web equivalent of the native pull-to-refresh
 * gesture, mirroring the one Chyme already ships in its header.
 *
 * By default it calls Next.js `router.refresh()` to re-pull the current route's server data. A shell
 * that loads its data client-side (fetch in a useEffect) should pass `onRefresh` with its own reload
 * function, because `router.refresh()` alone does not re-run client fetches. The icon spins while a
 * refresh is in flight and the button is disabled so it can't be double-fired.
 */
export function RefreshButton({
  onRefresh,
  title = 'Refresh',
  size = 16,
  color = 'currentColor',
  style,
}: {
  onRefresh?: () => void | Promise<void>;
  title?: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        router.refresh();
      }
    } catch {
      // The shell surfaces its own load errors; the button only drives the refresh.
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing, router]);

  return (
    <button
      type="button"
      onClick={() => void handleRefresh()}
      disabled={refreshing}
      title={title}
      aria-label={title}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: refreshing ? 'wait' : 'pointer',
        color,
        flexShrink: 0,
        ...style,
      }}
    >
      <RefreshCw size={size} className={refreshing ? 'animate-spin' : undefined} />
    </button>
  );
}
