// The right-hand cluster of the Apps home top bar, copied from the web MobileTopBar's .mobileBarAuth
// (components/community-shell/community-shell.tsx). Signed in: the report-a-bug button, which opens
// the same one-item "Report a problem" menu as the web HelpControl; the settings gear; the 32px
// account avatar. Signed out: the small gradient Sign in button (.mobileBarSignIn).
//
// The plugin screens' header keeps its own cluster (BarControls in ShellChrome.tsx), because the web
// MobileTopActions it copies opens the report form straight away and is spaced differently.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AlertCircle, Bug, Settings } from 'lucide-react-native';
import { useAuth } from '../../auth/auth-context';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../ui';
import { BugReportModal } from '../../features/bug-reporting';

// Web comic tokens the mobile token set has no field for: --ctf-surface-raised and
// --ctf-elevation-shadow (3px 3px 0 #d4c49a).
const COMIC_RAISED = '#1C1C1C';
const COMIC_SHADOW = '3px 3px 0px #D4C49A';

// The web brand gradient (linear-gradient(135deg, #7C3AED 0%, #0EA5E9 100%)) drawn behind a control.
function GradientFill({ width, height, id }: { width: number; height: number; id: string }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1={0} y1={0} x2={1} y2={1}>
          <Stop offset={0} stopColor="#7C3AED" />
          <Stop offset={1} stopColor="#0EA5E9" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

function SignInButton() {
  const { signIn } = useAuth();
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onPress = useCallback(async () => {
    setBusy(true);
    try {
      // signIn reports and alerts its own failures.
      await signIn();
    } finally {
      setBusy(false);
    }
  }, [signIn]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Sign in"
      activeOpacity={0.85}
      style={s.signIn}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {!tokens.isComic && size ? <GradientFill width={size.width} height={size.height} id="topbar-signin" /> : null}
      <Text style={s.signInText} numberOfLines={1}>
        Sign in
      </Text>
    </TouchableOpacity>
  );
}

// The web Clerk avatar (UserButton, 32px). It shows the account's profile picture; with none in the
// token it falls back to the web .mobileBarAvatar initial on the brand gradient.
function AccountAvatar({ onPress }: { onPress: () => void }) {
  const { user } = useAuth();
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const initial = (user?.username ?? user?.email ?? '?').charAt(0).toUpperCase();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Your account"
      style={[s.avatar, user?.imageUrl ? null : s.avatarFallback]}
    >
      {user?.imageUrl ? (
        <Image source={{ uri: user.imageUrl }} style={s.avatarImage} />
      ) : (
        <>
          {tokens.isComic ? null : <GradientFill width={32} height={32} id="topbar-avatar" />}
          <Text style={s.avatarInitial}>{initial}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// The web HelpControl: the bug button toggles a small menu anchored under it, right-aligned
// (.helpPopover at phone width: top calc(100% + 8px), right 0) with one "Report a problem" item.
function HelpControl() {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const { width: windowWidth } = useWindowDimensions();
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const openMenu = () => {
    buttonRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ top: y + h + 8, right: windowWidth - (x + w) });
    });
  };

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        style={[s.iconBtn, anchor ? s.iconBtnActive : null]}
        onPress={anchor ? () => setAnchor(null) : openMenu}
        accessibilityRole="button"
        accessibilityLabel="Report a bug"
        accessibilityState={{ expanded: Boolean(anchor) }}
      >
        <Bug size={18} color={anchor && tokens.isComic ? tokens.gold : tokens.textSecondary} />
      </TouchableOpacity>
      <Modal visible={Boolean(anchor)} transparent animationType="none" onRequestClose={() => setAnchor(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} accessibilityLabel="Close menu" />
        {anchor ? (
          <View style={[s.popover, { top: anchor.top, right: anchor.right }]} accessibilityRole="menu" accessibilityLabel="Help">
            <TouchableOpacity
              style={s.helpItem}
              accessibilityRole="menuitem"
              onPress={() => {
                setAnchor(null);
                setReportOpen(true);
              }}
            >
              <AlertCircle size={14} color="#A78BFA" />
              <Text style={s.helpItemLabel}>Report a problem</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </Modal>
      <BugReportModal visible={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}

export function TopBarControls({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { isAuthenticated } = useAuth();
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);

  if (!isAuthenticated) return <SignInButton />;

  return (
    <View style={s.controls}>
      <HelpControl />
      <TouchableOpacity
        style={s.iconBtn}
        onPress={onOpenAccount}
        accessibilityRole="button"
        accessibilityLabel="Account and settings"
      >
        <Settings size={18} color={tokens.textSecondary} />
      </TouchableOpacity>
      <AccountAvatar onPress={onOpenAccount} />
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    controls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    // .mobileBarAuth .iconRailBtn
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: t.isComic ? 0 : 10,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The open state. In the default theme the web bar's own button rule outranks .iconRailBtnActive,
    // so the button does not change; the comic .iconRailBtnActive rule comes later and does apply.
    iconBtnActive: t.isComic ? { backgroundColor: COMIC_RAISED, borderColor: t.border, boxShadow: COMIC_SHADOW } : {},
    popover: {
      position: 'absolute',
      minWidth: 210,
      paddingVertical: 6,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: t.isComic ? 0 : 14,
      boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.6)',
    },
    helpItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: 'rgba(167, 139, 250, 0.1)',
    },
    helpItemLabel: { fontSize: 13, fontFamily: interFamily('600'), color: '#C4B5FD' },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: t.isComic ? 0 : 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // .mobileBarAvatar, with its comic override.
    avatarFallback: {
      backgroundColor: t.isComic ? COMIC_RAISED : 'transparent',
      borderWidth: t.isComic ? 1 : 0,
      borderColor: t.border,
    },
    avatarImage: { width: 32, height: 32 },
    avatarInitial: { fontSize: 13, fontFamily: interFamily('700'), color: t.isComic ? t.border : '#FFFFFF' },
    ...signInStyles(t),
  });
}

// .mobileBarSignIn, and its comic override (ink panel, cream border, offset shadow). Kept apart from
// makeStyles so each stays under the complexity limit.
function signInStyles(t: ThemeTokens) {
  return {
    signIn: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: t.isComic ? 0 : 8,
      overflow: t.isComic ? 'visible' : 'hidden',
      backgroundColor: t.isComic ? t.surface : 'transparent',
      borderWidth: t.isComic ? 1.5 : 0,
      borderColor: t.border,
      boxShadow: t.isComic ? COMIC_SHADOW : undefined,
    },
    signInText: { fontSize: 13, fontFamily: interFamily('600'), color: t.isComic ? t.border : '#FFFFFF' },
  } as const;
}
