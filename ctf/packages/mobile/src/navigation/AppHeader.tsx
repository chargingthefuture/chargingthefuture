// The bar above each screen, as the web draws it: the top bar on Apps (web MobileTopBar), the shared
// back-chevron header everywhere else (web MobileScreenHeader, or the plugin's own header where the
// web plugin draws one), and nothing on the screens that draw the web's own header themselves.

import React, { type ReactNode } from 'react';
import { Code2, Gauge, Radio, UserCircle, Users, type LucideIcon } from 'lucide-react-native';
import { ScreenHeader, TopBar } from '../components/shell/ShellChrome';
import { AdminRefreshButton, HeaderPill } from '../components/shell/HeaderActions';
import { getAppAccent, useTheme, type ThemeName, type ThemeTokens } from '../theme';
import { getPluginEmoji } from '../theme/plugin-visuals';
import { usePPTheme } from '../features/peer-programming/usePPTheme';
import { getAccountTokens } from '../features/account';
import { hasSharedHeader, isAdminKey, parentOf, pluginOf, SCREEN_TITLES, type FeatureKey } from './screens';

type Open = (_key: FeatureKey) => void;

type HeaderLook = {
  accent?: string;
  emoji?: string;
  icon?: ReactNode;
  iconTile?: boolean;
  background?: string;
  gap?: number;
};

// The lucide icon a web header draws in the tile instead of the app's emoji.
const HEADER_ICONS: Partial<Record<FeatureKey, LucideIcon>> = {
  'chyme-admin': Gauge,
  'chyme-readings': Radio,
  beacon: Radio,
  'beacon-admin': Radio,
  'peer-programming-admin': Code2,
};

// The icon and accent of each header. A plugin screen shows the plugin's emoji, or the web's icon
// (HEADER_ICONS), in its accent. Your account shows UserCircle in the brand color (web /account).
// PeerProgramming draws its own title row on the web: Users bare (no tile), on the plugin's header
// color (#0D0F14) with 8px gaps.
function headerLook(key: FeatureKey, theme: ThemeName, tokens: ThemeTokens, ppHeader: string): HeaderLook {
  if (key === 'account') {
    const brand = getAccountTokens(tokens).BRAND;
    return { accent: brand, icon: <UserCircle size={18} color={brand} /> };
  }
  const plugin = pluginOf(key);
  if (!plugin) return {};
  const accent = getAppAccent(plugin, theme);
  if (key === 'peer-programming') {
    return { accent, icon: <Users size={18} color={accent} />, iconTile: false, background: ppHeader, gap: 8 };
  }
  const Icon = HEADER_ICONS[key];
  return Icon ? { accent, icon: <Icon size={18} color={accent} /> } : { accent, emoji: getPluginEmoji(plugin) };
}

// The controls the shell puts in the header's actions slot, as the web fills it. A member page shows
// an Admin button to admins; an admin page shows the admin refresh control (web AdminRefreshControl,
// which every admin header carries) and a Member view button. PeerProgramming puts its own buttons
// there (useHeaderActions in PeerProgramming and PeerProgrammingAdmin), so it has no entry here.
const ADMIN_PAGES: Partial<Record<FeatureKey, FeatureKey>> = { beacon: 'beacon-admin', chyme: 'chyme-admin' };
const MEMBER_PAGES: Partial<Record<FeatureKey, FeatureKey>> = {
  'beacon-admin': 'beacon',
  'chyme-admin': 'chyme',
  'chyme-readings': 'chyme',
};

function shellActions(key: FeatureKey, isAdmin: boolean, accent: string, open: Open, refresh: () => void): ReactNode {
  const adminPage = ADMIN_PAGES[key];
  if (adminPage) {
    return isAdmin ? <HeaderPill label="Admin" accent={accent} accessibilityLabel="Admin panel" onPress={() => open(adminPage)} /> : null;
  }
  if (!isAdminKey(key)) return null;
  const memberPage = MEMBER_PAGES[key];
  return (
    <>
      <AdminRefreshButton accent={accent} onRefresh={refresh} />
      {memberPage ? (
        <HeaderPill label="Member view" accent={accent} accessibilityLabel="Open the member view" onPress={() => open(memberPage)} />
      ) : null}
    </>
  );
}

export function AppHeader({
  selected,
  isAdmin,
  signedIn,
  open,
  onOpenAccount,
  onRefresh,
  screenActions,
}: {
  selected: FeatureKey;
  isAdmin: boolean;
  signedIn: boolean;
  open: Open;
  onOpenAccount: () => void;
  /** Remounts the open screen, for the admin refresh control. */
  onRefresh: () => void;
  /** Controls the open screen handed up through HeaderActionsContext. */
  screenActions: ReactNode;
}) {
  const { theme, tokens } = useTheme();
  const pp = usePPTheme();
  if (selected === 'apps') return <TopBar onOpenAccount={onOpenAccount} />;
  // Screens that draw the web's own header themselves: the account sub-screens, and Chyme signed out
  // (the web public page has its own header with Sign in).
  if (!hasSharedHeader(selected) || (selected === 'chyme' && !signedIn)) return null;
  const look = headerLook(selected, theme, tokens, pp.HEADER);
  const fromShell = shellActions(selected, isAdmin, look.accent ?? tokens.brand, open, onRefresh);
  return (
    <ScreenHeader
      title={SCREEN_TITLES[selected]}
      {...look}
      onBack={() => open(parentOf(selected))}
      onOpenAccount={onOpenAccount}
      pluginSlug={pluginOf(selected)}
      actions={fromShell || screenActions ? <>{fromShell}{screenActions}</> : undefined}
    />
  );
}
