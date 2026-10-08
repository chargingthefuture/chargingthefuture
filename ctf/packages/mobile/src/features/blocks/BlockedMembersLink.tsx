// The row at the top of Account & Data that opens Blocked members. The web reaches blocked members
// from its /account page; the Android app had them as their own tab in a row of pills, which is gone
// now that the app's frame matches the web. So, as on the web, they sit under the account screen.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ChevronRight, ShieldOff } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';

export function BlockedMembersLink({ onPress }: { onPress: () => void }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <TouchableOpacity style={s.row} onPress={onPress} accessibilityRole="button" accessibilityLabel="Blocked members">
      <ShieldOff size={18} color={tokens.textSecondary} />
      <Text style={s.label}>Blocked members</Text>
      <ChevronRight size={18} color={tokens.textSecondary} />
    </TouchableOpacity>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
    },
    label: { flex: 1, fontSize: 14, fontFamily: interFamily('600'), color: t.textPrimary },
  });
}
