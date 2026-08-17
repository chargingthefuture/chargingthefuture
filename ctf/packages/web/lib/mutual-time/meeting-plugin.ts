import type { MutualTimeMeetingPlugin } from './constants';

// Display name + in-app route for the plugin a chosen meeting points to ("Where we'll meet"). Kept
// dependency-free (no import of lib/plugins/repository, which pulls in server-only DB code) so it is
// safe to import from client components. The route mirrors getPluginRoute exactly (`/apps/<slug>`).
const MEETING_PLUGIN_NAMES: Record<MutualTimeMeetingPlugin, string> = {
  chyme: 'Chyme',
  'peer-programming': 'Peer Programming',
  beacon: 'Beacon',
};

export function meetingPluginName(plugin: MutualTimeMeetingPlugin): string {
  return MEETING_PLUGIN_NAMES[plugin] ?? plugin;
}

export function meetingPluginRoute(plugin: MutualTimeMeetingPlugin): string {
  return `/apps/${encodeURIComponent(plugin)}`;
}
