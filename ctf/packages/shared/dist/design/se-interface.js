// Which interface a member sees: '3.0' is the shipped app, '3.1' the social redesign. Chosen per
// account in Settings and stored in user_ui_preferences.interface_version, so it follows the member
// across web and Android. Everyone stays on '3.0' until they switch.
export const SE_INTERFACE_VERSIONS = ['3.0', '3.1'];
export const SE_DEFAULT_INTERFACE_VERSION = '3.0';
export function isSeInterfaceVersion(value) {
    return value === '3.0' || value === '3.1';
}
export const SE_TABS = ['today', 'people', 'new', 'activity', 'me'];
export const SE_TAB_LABELS = {
    today: 'Today',
    people: 'People',
    new: 'New',
    activity: 'Activity',
    me: 'Me',
};
