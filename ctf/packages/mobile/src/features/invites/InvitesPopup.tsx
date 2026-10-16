/**
 * InvitesPopup — one invitation to somebody listed in the Directory at a time, in a small card that
 * floats in the bottom corner of every signed-out plugin screen. Copied from the web's card (web
 * components/invites/invites-popup.tsx and its CSS module), which the web shows on every public
 * plugin page.
 *
 * The list is the app's public invite route: each person's name, the invite's opening words, its
 * date and the address that opens it in the Directory on the web, where reading it in full needs a
 * sign-in. Renders nothing when the list cannot be read or is empty.
 *
 * Nothing moves on its own. The visitor steps through with the two buttons and closes it with the
 * close control. The web keeps that dismissal for the browser session; here it lasts until the app
 * is closed, which is the nearest thing an installed app has.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { authedFetch } from '../../auth/authedFetch';
import { reportError } from '../../observability/report';

const INVITES_PATH = '/api/directory/invites/public';
const APPEAR_DELAY_MS = 2500;

type InviteCard = {
  name: string;
  url: string;
  date: string;
  opening: string;
};

// Closed for the rest of this app run, as the web's sessionStorage flag closes it for the tab.
let dismissedThisRun = false;

function formatDate(iso: string): string {
  const at = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function isInviteCard(value: unknown): value is InviteCard {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Record<string, unknown>;
  return ['name', 'url', 'date', 'opening'].every((key) => typeof card[key] === 'string');
}

function useInvites(): { invites: InviteCard[]; visible: boolean; hide: () => void } {
  const [invites, setInvites] = useState<InviteCard[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (dismissedThisRun) return;
    let canceled = false;
    let appearTimer: ReturnType<typeof setTimeout> | undefined;
    authedFetch(INVITES_PATH, { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : { invites: [] }))
      .then((data: { invites?: unknown }) => {
        if (canceled) return;
        const list = Array.isArray(data.invites) ? data.invites.filter(isInviteCard) : [];
        if (list.length === 0) return;
        setInvites(list);
        appearTimer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
      })
      .catch((error) => {
        // Additive: no list, no card. The failure is still recorded.
        reportError(error, { area: 'invites', op: 'popup_list_load' });
      });
    return () => {
      canceled = true;
      if (appearTimer !== undefined) clearTimeout(appearTimer);
    };
  }, []);

  function hide() {
    dismissedThisRun = true;
    setVisible(false);
  }

  return { invites, visible, hide };
}

// The web card rises 8px and fades in over 320ms, and appears at once when motion is reduced.
function useRise(visible: boolean): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    let canceled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (canceled) return;
      if (reduce) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    });
    return () => {
      canceled = true;
    };
  }, [visible, progress]);
  return progress;
}

export function InvitesPopup() {
  const { invites, visible, hide } = useInvites();
  const [index, setIndex] = useState(0);
  const progress = useRise(visible);

  if (!visible || invites.length === 0) return null;

  const invite = invites[index];

  function step(direction: -1 | 1) {
    setIndex((at) => (at + direction + invites.length) % invites.length);
  }

  const rise = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none" accessibilityLabel="Open invitations to people in the Directory">
      <Animated.View style={[styles.card, rise]}>
        <Pressable style={styles.close} onPress={hide} accessibilityRole="button" accessibilityLabel="Close the invitations" hitSlop={8}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <Text style={styles.eyebrow}>People already on the list</Text>
        <View accessibilityLiveRegion="polite">
          <Text style={styles.date}>{formatDate(invite.date)}</Text>
          <Text style={styles.title} accessibilityRole="header">
            An invitation to {invite.name}
          </Text>
          <Text style={styles.opening} numberOfLines={3}>
            {invite.opening}
          </Text>
        </View>
        <View style={styles.foot}>
          <Pressable onPress={() => void Linking.openURL(invite.url)} accessibilityRole="link">
            <Text style={styles.link}>Read the invitation →</Text>
          </Pressable>
          {invites.length > 1 ? (
            <View style={styles.buttons}>
              <Text style={styles.count}>
                {index + 1}/{invites.length}
              </Text>
              <Pressable style={styles.btn} onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Show the previous invitation">
                <Text style={styles.btnText}>‹</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="Show the next invitation">
                <Text style={styles.btnText}>›</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

// Values copied from web components/invites/invites-popup.module.css.
const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 50,
    maxWidth: 340,
  },
  card: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 22, 34, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    color: '#9ca3af',
    paddingRight: 22,
  },
  date: {
    fontSize: 11,
    color: '#9ca3af',
  },
  title: {
    marginTop: 2,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17.5,
    color: '#d5d9e2',
  },
  opening: {
    fontSize: 13,
    lineHeight: 18.85,
    color: '#cdd3e0',
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  link: {
    fontSize: 12,
    color: '#9fd0ff',
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  count: {
    fontSize: 11,
    color: '#9ca3af',
    marginRight: 2,
  },
  btn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#d5d9e2',
    fontSize: 17,
    lineHeight: 18,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeText: {
    color: '#9ca3af',
    fontSize: 16,
    lineHeight: 18,
  },
});
