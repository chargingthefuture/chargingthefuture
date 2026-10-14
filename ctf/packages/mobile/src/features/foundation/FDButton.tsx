// The Foundation button. Every web Foundation button is an inline-styled <button> with its own padding,
// radius, size and colors; this takes the same numbers so each use reads like the web style it copies.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { alpha, font, useFDTheme, type FDTokens } from './useFDTheme';

export type Look = { bg: string; border?: string; color: string };

// The looks the web Foundation screens repeat.
export function looks(t: FDTokens) {
  return {
    primary: { bg: t.ACCENT, color: '#1a1205' } as Look,
    primaryWhite: { bg: t.ACCENT, color: '#fff' } as Look,
    neutral: { bg: t.BORDER, border: 'rgba(255,255,255,0.12)', color: t.TITLE } as Look,
    danger: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: '#F87171' } as Look,
    soft: { bg: alpha(t.ACCENT, '15'), border: alpha(t.ACCENT, '30'), color: t.ACCENT } as Look,
  };
}

export type FDButtonProps = {
  label: string;
  onPress: () => void;
  look: Look;
  // [vertical, horizontal] padding, radius, font size and weight, as on the web style.
  pad: [number, number];
  radius: number;
  size: number;
  weight?: TextStyle['fontWeight'];
  icon?: LucideIcon;
  iconSize?: number;
  // Text after the label at weight 600 and 85% opacity, the web's "· rate" span.
  trailing?: string;
  disabled?: boolean;
  dimmed?: number;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

function buttonStyle(props: FDButtonProps, radius: number): StyleProp<ViewStyle> {
  const { look, pad } = props;
  return [
    styles.button,
    props.wide ? styles.wide : styles.hug,
    {
      paddingVertical: pad[0],
      paddingHorizontal: pad[1],
      borderRadius: radius,
      backgroundColor: look.bg,
      borderColor: look.border ?? 'transparent',
      borderWidth: look.border ? 1 : 0,
      opacity: props.disabled && props.dimmed !== undefined ? props.dimmed : 1,
    },
    props.style,
  ];
}

export function FDButton(props: FDButtonProps) {
  const { r } = useFDTheme();
  const { look, weight = '700', icon: Icon, disabled } = props;
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={buttonStyle(props, r(props.radius))}
    >
      {Icon ? <Icon size={props.iconSize ?? 16} color={look.color} /> : null}
      <Text style={[font(props.size, weight), { color: look.color }]}>{props.label}</Text>
      {props.trailing ? <Text style={[font(props.size, '600'), styles.trailing, { color: look.color }]}>{props.trailing}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  hug: { alignSelf: 'flex-start' },
  wide: { alignSelf: 'stretch' },
  trailing: { opacity: 0.85 },
});
