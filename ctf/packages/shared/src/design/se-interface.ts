// Which interface a member sees: '3.0' is the shipped app, '3.1' the social redesign. Chosen per
// account in Settings and stored in user_ui_preferences.interface_version, so it follows the member
// across web and Android. Everyone stays on '3.0' until they switch.

export type SeInterfaceVersion = '3.0' | '3.1';

export const SE_INTERFACE_VERSIONS: readonly SeInterfaceVersion[] = ['3.0', '3.1'] as const;
export const SE_DEFAULT_INTERFACE_VERSION: SeInterfaceVersion = '3.0';

export function isSeInterfaceVersion(value: unknown): value is SeInterfaceVersion {
  return value === '3.0' || value === '3.1';
}

// The five tabs of the 3.1 frame, in tab-bar order. 'new' is the round + button in the middle.
export type SeTab = 'today' | 'people' | 'new' | 'activity' | 'me';

export const SE_TABS: readonly SeTab[] = ['today', 'people', 'new', 'activity', 'me'] as const;

export const SE_TAB_LABELS: Record<SeTab, string> = {
  today: 'Today',
  people: 'People',
  new: 'New',
  activity: 'Activity',
  me: 'Me',
};
