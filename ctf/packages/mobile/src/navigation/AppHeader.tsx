// The bar above each screen, as the web draws it: the top bar on Apps (web MobileTopBar), the shared
// back-chevron header everywhere else (web MobileScreenHeader, or the plugin's own header where the
// web plugin draws one), and nothing on the screens that draw the web's own header themselves. The
// open screen can shape it through useScreenOverride (components/shell/HeaderActions.tsx).

import React, { type ReactNode } from 'react';
import { Briefcase, Code2, Gauge, Radio, UserCircle, Users, type LucideIcon } from 'lucide-react-native';
import { ScreenHeader, TopBar } from '../components/shell/ShellChrome';
import { HeaderPill, HeaderRefreshButton, type ScreenOverride } from '../components/shell/HeaderActions';
import { getAppAccent, useTheme, type ThemeName, type ThemeTokens } from '../theme';
import { getPluginEmoji } from '../theme/plugin-visuals';
import { usePPTheme } from '../features/peer-programming/usePPTheme';
import { getAccountTokens } from '../features/account';
import { hasSharedHeader, isAdminKey, pluginOf, SCREEN_TITLES, type FeatureKey } from './screens';

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
  'foundation-admin': Briefcase,
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

// Each member page with an admin page: the Admin pill (admins only) opens it, and its Member view
// pill comes back, as the web PluginAdminButton and PluginUserShellButton do.
const ADMIN_PAGES: Partial<Record<FeatureKey, FeatureKey>> = {
  beacon: 'beacon-admin',
  chyme: 'chyme-admin',
  'peer-programming': 'peer-programming-admin',
  foundation: 'foundation-admin',
};
const MEMBER_PAGES: Partial<Record<FeatureKey, FeatureKey>> = {
  'beacon-admin': 'beacon',
  'chyme-admin': 'chyme',
  'chyme-readings': 'chyme',
  'peer-programming-admin': 'peer-programming',
  'foundation-admin': 'foundation',
};

type ActionInput = {
  key: FeatureKey;
  isAdmin: boolean;
  accent: string;
  open: Open;
  /** Remounts the open screen, for an admin page that has no reload of its own. */
  remount: () => void;
  override: ScreenOverride | null;
};

// A member page: the Admin pill, then the screen's Refresh (web order). A screen inside the plugin (a
// profile, a chat) carries no Admin pill, as the web page it copies does not.
function memberActions({ key, isAdmin, accent, open, override }: ActionInput): ReactNode {
  const adminPage = ADMIN_PAGES[key];
  const pill = adminPage && isAdmin && !override?.onBack
    ? <HeaderPill label="Admin" accent={accent} accessibilityLabel="Admin panel" onPress={() => open(adminPage)} />
    : null;
  const refresh = override?.refresh ? <HeaderRefreshButton onRefresh={override.refresh} /> : null;
  return pill || refresh ? <>{pill}{refresh}</> : null;
}

// An admin page: the admin refresh control every web admin header carries, then Member view.
function adminActions({ key, accent, open, remount, override }: ActionInput): ReactNode {
  const memberPage = MEMBER_PAGES[key];
  return (
    <>
      <HeaderRefreshButton admin accent={accent} onRefresh={override?.refresh ?? remount} />
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
  onBack,
  onOpenAccount,
  onRefresh,
  override,
}: {
  selected: FeatureKey;
  isAdmin: boolean;
  signedIn: boolean;
  open: Open;
  /** Back from the selected screen (useAppNavigation knows where it was opened from). */
  onBack: () => void;
  onOpenAccount: () => void;
  /** Remounts the open screen, for the admin refresh control. */
  onRefresh: () => void;
  /** What the open screen asked of the header. */
  override: ScreenOverride | null;
}) {
  const { theme, tokens } = useTheme();
  const pp = usePPTheme();
  if (selected === 'apps') return <TopBar onOpenAccount={onOpenAccount} />;
  // Screens that draw the web's own header themselves: the account sub-screens and Recurring
  // Activity, and Chyme signed out (the web public page has its own header with Sign in).
  if (!hasSharedHeader(selected) || (selected === 'chyme' && !signedIn)) return null;
  const look = headerLook(selected, theme, tokens, pp.HEADER);
  const input: ActionInput = { key: selected, isAdmin, accent: look.accent ?? tokens.brand, open, remount: onRefresh, override };
  return (
    <ScreenHeader
      title={SCREEN_TITLES[selected]}
      {...look}
      onBack={override?.onBack ?? onBack}
      onOpenAccount={onOpenAccount}
      pluginSlug={pluginOf(selected)}
      actions={isAdminKey(selected) ? adminActions(input) : memberActions(input)}
    />
  );
}
