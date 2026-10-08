// The bar above each screen, as the web draws it: the top bar on Apps (web MobileTopBar), the shared
// back-chevron header everywhere else (web MobileScreenHeader, or the plugin's own header where the
// web plugin draws one).

import React, { type ReactNode } from 'react';
import { Code2, Users } from 'lucide-react-native';
import { ScreenHeader, TopBar } from '../components/shell/ShellChrome';
import { AdminRefreshButton, HeaderPill } from '../components/shell/HeaderActions';
import { getAppAccent, useTheme, type ThemeName } from '../theme';
import { getPluginEmoji } from '../theme/plugin-visuals';
import { usePPTheme } from '../features/peer-programming/usePPTheme';
import { isAdminKey, parentOf, pluginOf, SCREEN_TITLES, type FeatureKey } from './screens';

type Open = (_key: FeatureKey) => void;

type HeaderLook = {
  emoji?: string;
  icon?: ReactNode;
  iconTile?: boolean;
  background?: string;
  gap?: number;
};

// Screens whose web header differs from the plugin's emoji tile. PeerProgramming draws its own title
// row on the web: Users bare (no tile), on the #0D0F14 header color with 8px gaps. Its admin page
// uses the shared header with Code2 in the tile.
function headerLook(key: FeatureKey, theme: ThemeName, ppHeader: string): HeaderLook {
  const plugin = pluginOf(key);
  if (key === 'peer-programming') {
    const accent = getAppAccent('peer-programming', theme);
    return { icon: <Users size={18} color={accent} />, iconTile: false, background: ppHeader, gap: 8 };
  }
  if (key === 'peer-programming-admin') {
    return { icon: <Code2 size={18} color={getAppAccent('peer-programming', theme)} /> };
  }
  return { emoji: plugin ? getPluginEmoji(plugin) : undefined };
}

// The controls the shell puts in the header's actions slot, as the web fills it. A member page shows
// an Admin button to admins; an admin page shows the admin refresh control (web AdminRefreshControl,
// which every admin header carries) and a Member view button. PeerProgramming's member page puts its
// own Admin and Refresh buttons there (useHeaderActions), so it is not listed here.
const ADMIN_PAGES: Partial<Record<FeatureKey, FeatureKey>> = { beacon: 'beacon-admin' };
const MEMBER_PAGES: Partial<Record<FeatureKey, FeatureKey>> = { 'beacon-admin': 'beacon' };

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
  open,
  onOpenAccount,
  onRefresh,
  screenActions,
}: {
  selected: FeatureKey;
  isAdmin: boolean;
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
  const plugin = pluginOf(selected);
  const accent = plugin ? getAppAccent(plugin, theme) : undefined;
  const fromShell = shellActions(selected, isAdmin, accent ?? tokens.brand, open, onRefresh);
  return (
    <ScreenHeader
      title={SCREEN_TITLES[selected]}
      {...headerLook(selected, theme, pp.HEADER)}
      accent={accent}
      onBack={() => open(parentOf(selected))}
      onOpenAccount={onOpenAccount}
      pluginSlug={plugin}
      actions={fromShell || screenActions ? <>{fromShell}{screenActions}</> : undefined}
    />
  );
}
