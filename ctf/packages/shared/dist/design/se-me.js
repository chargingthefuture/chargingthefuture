// What the 3.1 Me screen shows, shared by web and Android: only what is the member's own, plus
// Settings. Making things is + New and reading is Today, so Me carries no tiles for either.
import { SE_DEFAULT_THEME, isSeThemeColor, isSeThemeMode } from './se-theme';
const RELEASES = 'https://github.com/chargingthefuture/chargingthefuture/releases';
export const SE_ME_LINKS = {
    credits: '/apps/service-credits',
    account: '/account',
    survey: '/survey/quora-account-deletions',
    architect: '/admin',
    wallpapers: `${RELEASES}?q=wallpapers`,
    androidApp: `${RELEASES}?q=mobile`,
};
export const SE_ME_TILES = [
    { key: 'click-log', label: 'ClickLog', text: 'Your private log of what happened, and check-ins when you are safe.', href: '/apps/click-log' },
    { key: 'trust', label: 'Trust', text: 'What others can see of your part in the Avenhood.', href: '/apps/trust' },
    { key: 'reader', label: 'Reader', text: 'Your feed reader. Your subscriptions are yours alone.', href: '/apps/reader' },
];
export const SE_ME_WORDS = {
    credits: 'ServiceCredits',
    creditsUnit: (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`,
    creditsFailed: 'Could not read your ServiceCredits this time.',
    send: 'Send',
    receive: 'Receive',
    receiveCopied: (handle) => `Copied ${handle}. Anyone can send to it.`,
    receiveCopyFailed: (handle, reason) => `Could not copy (${reason}). Your handle is ${handle}.`,
    receiveNoHandle: 'Choose a handle in Account and data to receive.',
    history: 'History',
    theme: 'Colors',
    themeText: 'Saved on this device.',
    dark: 'Dark',
    light: 'Light',
    version: 'You are using 3.1. You can go back to 3.0 at any time.',
    backTo30: 'Back to 3.0',
    account: 'Account and data',
    survey: 'Quora account deletion survey',
    wallpapers: 'Wallpapers',
    androidApp: 'The Android app',
    architect: 'System Architect',
    architectText: 'Admin screens.',
};
export const SE_THEME_STORE_KEY = 'se-theme';
export function seParseThemeChoice(raw) {
    try {
        const value = raw ? JSON.parse(raw) : {};
        return {
            color: isSeThemeColor(value.color) ? value.color : SE_DEFAULT_THEME.color,
            mode: isSeThemeMode(value.mode) ? value.mode : SE_DEFAULT_THEME.mode,
        };
    }
    catch {
        return { ...SE_DEFAULT_THEME };
    }
}
