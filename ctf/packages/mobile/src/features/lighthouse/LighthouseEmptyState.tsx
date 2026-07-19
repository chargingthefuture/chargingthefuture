import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';

export const LighthouseEmptyState: React.FC = () => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="home-outline" size={30} color={`${accent}80`} />
      </View>
      <Text style={styles.heading}>No listings match</Text>
      <Text style={styles.body}>
        Check back soon for new housing listings near you.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8}>
        <Ionicons name="search-outline" size={16} color="#000" />
        <Text style={styles.primaryBtnText}>Adjust Filters</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
        <Ionicons name="notifications-outline" size={16} color={tokens.textPrimary} />
        <Text style={styles.secondaryBtnText}>Alert Me</Text>
      </TouchableOpacity>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${accent}15`,
      borderWidth: 1,
      borderColor: `${accent}40`,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    heading: {
      fontSize: 18,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
    },
    body: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 8,
    },
    privacyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: `${accent}10`,
      borderWidth: 1,
      borderColor: `${accent}20`,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 24,
    },
    privacyText: {
      fontSize: 12,
      color: t.textSecondary,
      marginLeft: 4,
    },
    primaryBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: accent,
      borderRadius: t.radius,
      paddingVertical: 14,
      marginBottom: 12,
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#000',
      marginLeft: 4,
    },
    secondaryBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.radius,
      paddingVertical: 14,
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.textPrimary,
      marginLeft: 4,
    },
  });
}
