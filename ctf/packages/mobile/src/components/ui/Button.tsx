// Themed button primitive.
//
// Variants:
//   - brand   The CTA / logo treatment. Default theme = the purple→cyan brand gradient (web
//             `--ctf-cta-bg: linear-gradient(135deg, #7c3aed, #0ea5e9)`), white label. Comic theme =
//             a flat ink panel with a hard cream border and cream label (web `--ctf-cta-*` comic).
//   - primary Solid accent fill (defaults to tokens.gold), contrast label.
//   - outline Transparent fill, hairline border, accent label.
//   - ghost   Transparent fill, no border, accent label.
//
// `CtaButton` is `Button` pinned to the brand variant. RN has no CSS gradients, so the brand fill is
// drawn with react-native-svg behind the label.

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme, type ThemeTokens } from '../../theme';
import { typeScale } from './typography';

export type ButtonVariant = 'primary' | 'brand' | 'outline' | 'ghost';

type ButtonProps = {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  /** Accent color for primary fill and outline/ghost label. Defaults to tokens.gold. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
};

const BRAND_GRADIENT_ID = 'ctf-brand-cta';

export function Button({
  title,
  children,
  onPress,
  disabled = false,
  variant = 'primary',
  accent,
  style,
}: ButtonProps) {
  const { tokens } = useTheme();
  const resolvedAccent = accent ?? tokens.gold;
  const s = makeStyles(tokens);

  // Per-variant container + label colors. brand is handled specially below for the default-theme
  // gradient fill; every other case is a flat background.
  const isBrandGradient = variant === 'brand' && !tokens.isComic;

  const container = containerStyleFor(variant, tokens, resolvedAccent);
  const labelColor = labelColorFor(variant, tokens, resolvedAccent);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[s.base, container, disabled ? s.disabled : null, style]}
    >
      {isBrandGradient ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={BRAND_GRADIENT_ID} x1={0} y1={0} x2={1} y2={1}>
              <Stop offset={0} stopColor="#7C3AED" />
              <Stop offset={1} stopColor="#0EA5E9" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${BRAND_GRADIENT_ID})`} />
        </Svg>
      ) : null}
      {children ?? (
        <Text style={[typeScale.button, { color: labelColor }]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// CtaButton — the brand-variant button, so callers can drop in a CTA without passing `variant`.
export function CtaButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="brand" />;
}

function containerStyleFor(
  variant: ButtonVariant,
  t: ThemeTokens,
  accent: string,
): ViewStyle {
  switch (variant) {
    case 'brand':
      // Default theme fills with the SVG gradient (transparent here so the gradient shows); comic
      // theme is a flat ink panel with a hard cream border.
      return t.isComic
        ? {
            backgroundColor: t.surface,
            borderWidth: 1.5,
            borderColor: t.border,
            borderRadius: 0,
          }
        : {
            backgroundColor: 'transparent',
            borderRadius: t.radiusControl,
            overflow: 'hidden',
          };
    case 'primary':
      return {
        backgroundColor: accent,
        borderRadius: t.radiusControl,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: t.radiusControl,
      };
    case 'ghost':
    default:
      return {
        backgroundColor: 'transparent',
        borderRadius: t.radiusControl,
      };
  }
}

function labelColorFor(variant: ButtonVariant, t: ThemeTokens, accent: string): string {
  switch (variant) {
    case 'brand':
      return t.isComic ? t.border : t.brandText;
    case 'primary':
      return t.brandText;
    case 'outline':
    case 'ghost':
    default:
      return accent;
  }
}

function makeStyles(_t: ThemeTokens) {
  return StyleSheet.create({
    base: {
      paddingVertical: 11,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      minHeight: 44,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
