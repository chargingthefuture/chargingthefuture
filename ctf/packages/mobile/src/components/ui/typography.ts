// Shared mobile type scale — the branding-parity target for future screen migration.
//
// These fragments mirror WEB's inline type scale (web is the reference, owner decision
// 2026-07-10). Note the deliberate differences from some older mobile screens: the plugin/
// screen title is 700 (not 800), the button label is 13 (not 15), and the hero is 56. New
// and migrated screens should read from `typeScale` rather than hand-rolling font sizes so
// the two platforms stay visually in step.

import type { TextStyle } from 'react-native';

export const typeScale = {
  /** Marketing / splash hero number or wordmark. */
  hero: { fontSize: 56, fontWeight: '900' } as TextStyle,
  /** Plugin / screen title. 700, not 800. */
  title: { fontSize: 20, fontWeight: '700' } as TextStyle,
  /** Section heading. */
  heading: { fontSize: 16, fontWeight: '700' } as TextStyle,
  /** Card title. */
  cardTitle: { fontSize: 16, fontWeight: '700' } as TextStyle,
  /** Large stat / metric callout. */
  stat: { fontSize: 24, fontWeight: '800' } as TextStyle,
  /** Body copy. */
  body: { fontSize: 13, fontWeight: '400' } as TextStyle,
  /** Emphasised body copy. */
  bodyStrong: { fontSize: 13, fontWeight: '600' } as TextStyle,
  /** Field / meta label. */
  label: { fontSize: 12, fontWeight: '600' } as TextStyle,
  /** Small uppercase eyebrow above a heading. */
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as TextStyle,
  /** Button label. 13, not 15. */
  button: { fontSize: 13, fontWeight: '700' } as TextStyle,
} as const;

export type TypeScaleKey = keyof typeof typeScale;
