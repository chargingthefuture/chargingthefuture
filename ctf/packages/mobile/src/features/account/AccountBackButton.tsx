// The web BackChevronButton (lib/nav/back-history.tsx) that the Account & Data and Blocked members
// headers draw: an accent-tinted square with a chevron at 53% of its size.

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { radius } from './tokens';

export function AccountBackButton({ accent, size = 38, onPress }: { accent: string; size?: number; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{
        width: size,
        height: size,
        borderRadius: radius(tokens, 10),
        backgroundColor: `${accent}1A`,
        borderWidth: 1,
        borderColor: `${accent}4D`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChevronLeft size={Math.round(size * 0.53)} color={accent} />
    </TouchableOpacity>
  );
}
