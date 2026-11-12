'use client';

import type { CSSProperties, ReactNode } from 'react';
import { seThemeVars } from '@/components/se-frame/se-theme-vars';
import { useSeTheme } from '@/components/se-frame/use-se-theme';
import styles from './admin-se-scope.module.css';

// Every /admin screen in the 3.1 look, reached from Me's System Architect badge. The admin screens
// read two sets of color names: the app-wide --ctf-* properties and the --ctf-shell-* properties
// from plugin-shell-theme.ts. The stylesheet points both at the member's 3.1 colors, so the screens
// change with no change to what they show or do. Always the dark side of the member's color: every
// admin screen also paints its plugin's own accent and status colors, which were chosen for a dark
// background and are too pale to read on the light sand.
export function AdminSeScope({ children }: { children: ReactNode }) {
  const { theme } = useSeTheme();
  const vars: CSSProperties = seThemeVars(theme.color, 'dark');
  return (
    <div className={styles.scope} style={vars}>
      {children}
    </div>
  );
}
