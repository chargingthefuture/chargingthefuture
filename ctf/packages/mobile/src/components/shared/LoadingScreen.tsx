import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Universal app-wide loading screen. Shows the "Exit Their Economy / Exit The
 * Psyop" branded loading state, matching the web app's `app/loading.tsx` and the
 * canonical design mockups (HubLoading / MobileHomeLoading in the design submodule).
 *
 * Guardrail from the design spec: loading screens are NOT theme-toggled. Always
 * render the canonical dark treatment (#0F1117), regardless of any app theme.
 */
export function LoadingScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.inner}>
        <Text style={[styles.line, styles.lineLead]}>EXIT THEIR ECONOMY</Text>
        <Text style={styles.line}>EXIT THE PSYOP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  line: {
    fontSize: 10,
    // 0.16em of a 10px glyph ~ 1.6px tracking, matching MobileHomeLoading.
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  lineLead: {
    marginBottom: 14,
  },
});

export default LoadingScreen;
