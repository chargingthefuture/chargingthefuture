import type { CSSProperties } from 'react';
import { Globe } from 'lucide-react';

/**
 * "Open to members worldwide" line for a plugin's signed-out visitor shell. It sits under the
 * shell's description, in the shell's own muted text color. Chyme's shell leaves it out because
 * that page already carries a lot.
 */
export function PublicShellWorldwide({ color, style }: { color: string; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <Globe size={13} color={color} />
      <span style={{ fontSize: 12, color }}>Open to members worldwide</span>
    </div>
  );
}
