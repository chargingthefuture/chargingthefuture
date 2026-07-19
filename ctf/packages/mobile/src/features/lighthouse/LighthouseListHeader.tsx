import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';

interface Props {
  total: number;
}

export const LighthouseListHeader: React.FC<Props> = ({ total }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Ionicons name="home" size={18} color={accent} />
        </View>
        <View>
          <Text style={styles.title}>LightHouse</Text>
          <Text style={styles.subtitle}>
            {total > 0 ? `${total.toLocaleString()} listings` : 'Community housing listings'}
          </Text>
        </View>
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      paddingBottom: 12,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: `${accent}30`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: t.textPrimary,
    },
    subtitle: {
      fontSize: 11,
      color: accent,
    },
  });
}
