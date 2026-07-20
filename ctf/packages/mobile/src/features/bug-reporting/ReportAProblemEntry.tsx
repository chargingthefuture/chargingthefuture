// "Report a problem" entry row (mobile) — pixel-pass to the Support section of
// design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/MobileReportAProblem.tsx
//
// Drop this row into the app's Settings list (the mockup places it under a "Support"
// group). Tapping it opens the BugReportModal. The companion "Help center" row from
// the mockup is omitted: no help-center URL exists in the app or config yet, and the
// real-data-only rule forbids a dead link. Add it back when a real URL exists.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { BugReportModal } from './BugReportModal';

type ReportAProblemEntryProps = {
  // Optional: the plugin the member is using, passed through to the report so triage
  // knows where the problem was hit.
  pluginSlug?: string;
};

export function ReportAProblemEntry({ pluginSlug }: ReportAProblemEntryProps) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [open, setOpen] = useState(false);
  const accent = tokens.isComic ? tokens.gold : '#A78BFA';

  return (
    <View>
      <TouchableOpacity
        style={s.row}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Report a problem"
      >
        <View style={s.iconWrap}>
          <AlertCircle size={18} color={accent} strokeWidth={2} />
        </View>
        <Text style={s.label}>Report a problem</Text>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      <BugReportModal visible={open} onClose={() => setOpen(false)} pluginSlug={pluginSlug} />
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  const accent = t.isComic ? t.gold : '#A78BFA';
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: t.isComic ? `${accent}10` : 'rgba(167,139,250,0.07)',
      borderRadius: t.isComic ? 0 : 14,
      borderWidth: t.isComic ? 1.5 : 1,
      borderColor: t.isComic ? accent : 'rgba(167,139,250,0.2)',
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: t.isComic ? 0 : 10,
      backgroundColor: t.isComic ? `${accent}1A` : 'rgba(167,139,250,0.15)',
      borderWidth: t.isComic ? 1.5 : 0,
      borderColor: accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: { fontSize: 18, fontWeight: '800', fontFamily: interFamily('800'), color: accent },
    label: { flex: 1, fontSize: 14, fontWeight: '700', fontFamily: interFamily('700'), color: t.isComic ? t.textPrimary : '#C4B5FD' },
    chevron: { fontSize: 20, color: accent, fontFamily: interFamily('400') },
  });
}
