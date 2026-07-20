// Shared mobile type scale — the branding-parity target for future screen migration.
//
// These fragments mirror WEB's inline type scale (web is the reference, owner decision
// 2026-07-10). Note the deliberate differences from some older mobile screens: the plugin/
// screen title is 700 (not 800), the button label is 13 (not 15), and the hero is 56. New
// and migrated screens should read from `typeScale` rather than hand-rolling font sizes so
// the two platforms stay visually in step.
//
// Each entry also pins the matching Inter family (loaded in App.tsx via @expo-google-fonts/inter)
// so text rendered through the scale uses the brand typeface at the correct weight. React Native
// does not synthesise a bold face from a single family, so the weight must be carried by the family
// name (Inter_700Bold, …); `fontWeight` is kept too as a graceful fallback before the font loads.

import type { TextStyle } from 'react-native';

// Map a numeric weight to its bundled Inter family. Keep in sync with the useFonts() map in App.tsx.
const INTER: Record<string, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

// Resolve the bundled Inter family for a React Native `fontWeight`, so a screen can render the brand
// typeface at its own existing sizes/weights without re-scaling. RN does not synthesise a bold face
// from a single family, so the weight must be carried by the family name. Unmapped weights (e.g.
// 'bold', 'normal', numbers) fall back to regular. Pass the string weight used in the style.
export function interFamily(weight: TextStyle['fontWeight']): string {
  if (typeof weight === 'string' && INTER[weight]) return INTER[weight];
  if (weight === 'bold') return INTER['700'];
  return INTER['400'];
}

function scale(fontSize: number, fontWeight: TextStyle['fontWeight'], extra?: TextStyle): TextStyle {
  const fontFamily = typeof fontWeight === 'string' ? INTER[fontWeight] : undefined;
  return { fontSize, fontWeight, ...(fontFamily ? { fontFamily } : {}), ...extra };
}

export const typeScale = {
  /** Marketing / splash hero number or wordmark. */
  hero: scale(56, '900'),
  /** Plugin / screen title. 700, not 800. */
  title: scale(20, '700'),
  /** Section heading. */
  heading: scale(16, '700'),
  /** Card title. */
  cardTitle: scale(16, '700'),
  /** Large stat / metric callout. */
  stat: scale(24, '800'),
  /** Body copy. */
  body: scale(13, '400'),
  /** Emphasised body copy. */
  bodyStrong: scale(13, '600'),
  /** Field / meta label. */
  label: scale(12, '600'),
  /** Small uppercase eyebrow above a heading. */
  eyebrow: scale(11, '700', { letterSpacing: 1, textTransform: 'uppercase' }),
  /** Button label. 13, not 15. */
  button: scale(13, '700'),
} as const;

export type TypeScaleKey = keyof typeof typeScale;
