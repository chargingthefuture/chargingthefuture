// The Android app's frame, drawn to match the web app at phone width (owner directive, 2026-10-08:
// the Android app looks like the web app). Each piece names the web component it copies, so a change
// on the web side has an obvious counterpart here.
//
//   - TopBar        web MobileTopBar (components/community-shell/community-shell.tsx): the 52px bar
//                   on the Apps home — mark, wordmark, then report / settings / avatar, or Sign in
//                   when signed out (TopBarControls.tsx).
//   - ScreenHeader  web MobileScreenHeader (components/shared/mobile-screen-header.tsx): the bar on
//                   every app screen — back chevron, app icon tile, title, then the same controls.
//   - ShellBackground  the web .shell backdrop: two soft glows (purple top left, cyan top right).

import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Bug, ChevronLeft, Settings } from 'lucide-react-native';
import { useAuth } from '../../auth/auth-context';
import { useTheme, type ThemeTokens } from '../../theme';
import { CtaButton, interFamily } from '../ui';
import { BugReportModal } from '../../features/bug-reporting';
import { TopBarControls } from './TopBarControls';

// The Skills Economy "Stack" mark (web components/shared/se-mark.tsx), always in its gradient. The
// web .mobileBarLogo box is 30px, radius 9, with no fill; the comic theme gives it the raised ink
// panel, a 1px cream border and the offset shadow.
const SE_MARK_PATH =
  'm94 105.7h-26v-7.7h25.5c1.5-0.1 3.1-1.3 3.1-3.3v-11.7c0-1.5-1.2-2.9-2.8-2.9l-22.5-0.1c-1.7 0-3.3 1.4-3.3 3.1l0.1 9.7h-24.8c-1.6 0-3 1.3-3 2.9v12.9h-25.7c-1.6 0-3.1 1.3-3.1 2.9v8.1c0 1.4 1.2 2.7 2.6 2.7h79.9c1.5 0 2.8-1.3 2.9-2.7v-11.3c-0.2-1.3-1.4-2.6-2.9-2.6zm-0.2 21.2h-79.3c-1.4 0-2.9 1.2-2.9 2.8v8.3c0 1.4 1.2 3 2.8 3h79.6c1.6 0 2.8-1.3 2.8-2.8v-8c0-1.8-1.4-3.2-3-3.3z';

export function BrandMark({ size = 26 }: { size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width: size + 4,
        height: size + 4,
        borderRadius: tokens.isComic ? 0 : 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.isComic ? '#1C1C1C' : 'transparent',
        borderWidth: tokens.isComic ? 1 : 0,
        borderColor: tokens.border,
        boxShadow: tokens.isComic ? '3px 3px 0px #D4C49A' : undefined,
      }}
    >
      <Svg width={size} height={size} viewBox="4 67.9 100 85">
        <Defs>
          <LinearGradient id="brandmark" x1="11.51" y1="110.4" x2="96.71" y2="110.4" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#006D72" />
            <Stop offset="1" stopColor="#8F4BB2" />
          </LinearGradient>
        </Defs>
        <Path d={SE_MARK_PATH} fill="url(#brandmark)" />
      </Svg>
    </View>
  );
}

// The web .shell background: rgba(124,58,237,.22) at 15% 10% fading out by 35%, and
// rgba(14,165,233,.15) at 85% 5% fading out by 28%, over the page color. The comic theme is flat.
export function ShellBackground() {
  const { tokens } = useTheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  if (tokens.isComic) return null;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <RadialGradient id="glowPurple" cx={size.width * 0.15} cy={size.height * 0.1} r={Math.hypot(size.width, size.height) * 0.35} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#7C3AED" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#7C3AED" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="glowCyan" cx={size.width * 0.85} cy={size.height * 0.05} r={Math.hypot(size.width, size.height) * 0.28} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#0EA5E9" stopOpacity={0.15} />
              <Stop offset="1" stopColor="#0EA5E9" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#glowPurple)" />
          <Rect width={size.width} height={size.height} fill="url(#glowCyan)" />
        </Svg>
      ) : null}
    </View>
  );
}

type ChromeActions = {
  /** Opens Account & Data — the gear, as the web gear opens /account. */
  onOpenAccount: () => void;
  /** The plugin the member is in, passed to the bug report so triage knows where it happened. */
  pluginSlug?: string;
};

// The right-hand cluster both bars share: report a problem and settings when signed in, the small
// gradient Sign in button when signed out (web .mobileBarSignIn).
function BarControls({ onOpenAccount, pluginSlug }: ChromeActions) {
  const { isAuthenticated, signIn } = useAuth();
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [bugOpen, setBugOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const onSignIn = useCallback(async () => {
    setSigningIn(true);
    try {
      // signIn reports and alerts its own failures.
      await signIn();
    } finally {
      setSigningIn(false);
    }
  }, [signIn]);

  if (!isAuthenticated) {
    return (
      <CtaButton
        title={signingIn ? 'Signing in…' : 'Sign in'}
        onPress={onSignIn}
        disabled={signingIn}
        style={s.signIn}
      />
    );
  }

  return (
    <View style={s.controls}>
      <TouchableOpacity
        style={s.iconBtn}
        onPress={() => setBugOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Report a problem"
      >
        <Bug size={18} color={tokens.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={s.iconBtn}
        onPress={onOpenAccount}
        accessibilityRole="button"
        accessibilityLabel="Account and settings"
      >
        <Settings size={18} color={tokens.textSecondary} />
      </TouchableOpacity>
      <BugReportModal visible={bugOpen} onClose={() => setBugOpen(false)} pluginSlug={pluginSlug} />
    </View>
  );
}

export function TopBar({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { isAuthenticated } = useAuth();
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={s.topBar}>
      <BrandMark />
      {/* Signed out: the "SE / SKILLS ECONOMY" lockup. Signed in: the two-line "SKILLS / ECONOMY". */}
      {isAuthenticated ? (
        <View style={s.wordmarkStacked}>
          <Text style={s.stackedLine}>Skills</Text>
          <Text style={s.stackedLine}>Economy</Text>
        </View>
      ) : (
        <View style={s.wordmark}>
          <Text style={s.initials}>SE</Text>
          <Text style={s.lockupName}>Skills Economy</Text>
        </View>
      )}
      <View style={s.spacer} />
      <TopBarControls onOpenAccount={onOpenAccount} />
    </View>
  );
}

export function ScreenHeader({
  title,
  emoji,
  icon,
  iconTile = true,
  accent,
  onBack,
  actions,
  background,
  gap,
  ...chrome
}: ChromeActions & {
  title: string;
  emoji?: string;
  /** An icon drawn in the app icon tile instead of the emoji (web MobileScreenHeader `icon`). */
  icon?: ReactNode;
  /** False draws `icon` on its own, as a plugin header that builds its own title row does on the web. */
  iconTile?: boolean;
  accent?: string;
  onBack: () => void;
  /** The screen's own controls, before report / settings (web MobileScreenHeader `actions`). */
  actions?: ReactNode;
  /** The bar color, for a plugin that draws its own header bar on the web (PeerProgramming). */
  background?: string;
  /** The space between the items in the bar and in the actions cluster, for the same case. */
  gap?: number;
}) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const chevronColor = accent ?? tokens.textPrimary;
  return (
    <View
      style={[
        s.screenHeader,
        background === undefined ? null : { backgroundColor: background },
        gap === undefined ? null : { gap },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[
          s.iconBtn,
          accent ? { backgroundColor: `${accent}1A`, borderColor: `${accent}4D` } : null,
        ]}
      >
        <ChevronLeft size={20} color={chevronColor} />
      </TouchableOpacity>
      {icon && !iconTile ? icon : null}
      {(icon && iconTile) || (!icon && emoji) ? (
        <View
          style={[
            s.appIcon,
            accent ? { backgroundColor: `${accent}26`, borderColor: `${accent}66` } : null,
          ]}
        >
          {icon ?? <Text style={s.appIconEmoji}>{emoji}</Text>}
        </View>
      ) : null}
      <Text style={s.screenTitle} numberOfLines={1}>
        {title}
      </Text>
      {/* The web header's `actions` slot (an Admin or Member view button, a refresh control) sits
          before the shared controls, 10px apart. */}
      {actions ? <View style={[s.actions, gap === undefined ? null : { gap }]}>{actions}</View> : null}
      <BarControls {...chrome} />
    </View>
  );
}

// web --ctf-text-subtle; the comic theme has no separate subtle shade.
function subtle(t: ThemeTokens): string {
  return t.isComic ? t.textSecondary : '#6B7280';
}

function makeStyles(t: ThemeTokens) {
  const square = {
    width: 38,
    height: 38,
    borderRadius: t.isComic ? 0 : 10,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return StyleSheet.create({
    topBar: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      // Hard-coded on the web too, so the comic bar keeps the same faint line.
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    // Both lockups are set at line-height 1 on the web.
    wordmark: { justifyContent: 'center', flexShrink: 1, overflow: 'hidden' },
    wordmarkStacked: { justifyContent: 'center', gap: 1, flexShrink: 1, overflow: 'hidden' },
    initials: { fontSize: 17, lineHeight: 17, fontFamily: interFamily('800'), letterSpacing: 0.5, color: t.textShell },
    lockupName: {
      marginTop: 2,
      fontSize: 7,
      lineHeight: 7,
      fontFamily: interFamily('600'),
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: subtle(t),
    },
    stackedLine: {
      fontSize: 8,
      lineHeight: 8,
      fontFamily: interFamily('600'),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: subtle(t),
    },
    spacer: { flex: 1 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: square,
    signIn: { minHeight: 34, paddingVertical: 7, paddingHorizontal: 14 },
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: t.bg,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    appIcon: {
      width: 32,
      height: 32,
      borderRadius: t.isComic ? 0 : 9,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appIconEmoji: { fontSize: 16 },
    screenTitle: { flex: 1, fontSize: 15, fontFamily: interFamily('700'), color: t.textPrimary },
  });
}
