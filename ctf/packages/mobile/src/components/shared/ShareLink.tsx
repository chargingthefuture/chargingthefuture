import React, { useMemo, useState } from 'react';
import { Text, Modal, TouchableOpacity, Pressable, StyleSheet, Linking, Share } from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';

// THE shared way to share any URL across the mobile app — the React Native counterpart of the web
// `ShareLink` (the v2 "useLink" pattern). A trigger opens a popup that (1) shows the full link, (2)
// opens it, and (3) copies/shares it through the OS share sheet (which includes Copy on iOS and
// Android — no extra dependency). Every share/copy-link affordance must use this. See
// .claude/rules/130-link-sharing-and-copy-url-rules.mdc.
//
// Callers pass an ABSOLUTE url (the mobile app has no page origin to resolve a relative path against).

type ShareLinkProps = {
  /** Absolute URL to share. */
  url: string;
  /** Visible text on the trigger. */
  label?: string;
  /** Heading shown in the popup. */
  title?: string;
  /** Accent color for the trigger text. */
  color?: string;
};

export function ShareLink({ url, label = 'Share', title = 'Share this link', color = '#FB923C' }: ShareLinkProps) {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [open, setOpen] = useState(false);

  async function openLink() {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      }
    } catch {
      // no-trace: nothing to do if the OS cannot open the link
    }
    setOpen(false);
  }

  async function shareLink() {
    try {
      await Share.share({ message: url, url });
    } catch {
      // no-trace: the member dismissed the share sheet
    }
    setOpen(false);
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} link`}
        accessibilityHint="Opens a menu to view, open, or copy the link"
      >
        <Text style={[styles.trigger, { color }]}>{label}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.url} selectable accessibilityLabel={`Link, ${url}`}>
              {url}
            </Text>
            <TouchableOpacity style={styles.item} onPress={() => void openLink()} accessibilityRole="button">
              <Text style={styles.itemText}>Open link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={() => void shareLink()} accessibilityRole="button">
              <Text style={styles.itemText}>Copy or share link</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    trigger: { fontSize: 12, fontWeight: '600' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: t.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 12 },
    title: { fontSize: 13, fontWeight: '700', color: t.textSecondary },
    url: { fontSize: 13, color: t.textShell, padding: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8 },
    item: { paddingVertical: 12 },
    itemText: { fontSize: 15, fontWeight: '600', color: t.textShell },
  });
}
