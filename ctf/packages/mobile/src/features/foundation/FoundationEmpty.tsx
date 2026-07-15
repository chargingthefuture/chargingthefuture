import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

/**
 * Foundation empty state. The copy depends on WHY the list is empty:
 * - a skill filter is on → point the member at clearing it or trying another skill;
 * - a search term is typed → suggest a different search;
 * - no filter at all → the list is empty because nobody has offered a skill yet, so
 *   "clear the filter" would be nonsense — say plainly that providers show up once
 *   members opt in.
 * (No "post a service"/"get job alerts" buttons and no cash mention — Foundation has
 * no such actions, and rates are ServiceCredits only.)
 */
export function FoundationEmpty({
  activeSkill = false,
  searchActive = false,
}: {
  activeSkill?: boolean;
  searchActive?: boolean;
}) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('foundation', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const filtered = activeSkill || searchActive;
  const title = filtered ? 'No providers match' : 'No providers offering skills yet';
  const desc = activeSkill
    ? 'Try a different skill, or clear the filter to see everyone.'
    : searchActive
      ? 'Try a different search.'
      : 'Everyone here opts in before they show up. Check back soon as members offer skills.';
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {/* Hammer placeholder — uses text glyph since lucide-react-native not available */}
        <Text style={styles.iconText}>&#x1F528;</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{desc}</Text>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: `${accent}15`,
      borderWidth: 1,
      borderColor: `${accent}40`,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    iconText: {
      fontSize: 30,
      opacity: 0.5,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: t.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
    },
    desc: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
    },
  });
}
