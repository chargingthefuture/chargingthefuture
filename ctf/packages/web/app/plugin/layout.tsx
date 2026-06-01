import type { ReactNode } from 'react';

/**
 * Wraps every routed `/plugin/*` screen in the shared app viewport so plugin
 * shells reflow to a single scrolling column on phones. On desktop it is an
 * inert full-width wrapper. See `.ctf-app-viewport` in `globals.css`.
 */
export default function PluginLayout({ children }: { children: ReactNode }) {
  return <div className="ctf-app-viewport">{children}</div>;
}
