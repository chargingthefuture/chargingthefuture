// Font family names for the 3.1 screens, as loaded by useFonts in App.tsx. Bundled with the app;
// nothing is fetched at run time. With Settings → Easier-to-read font on, every name reads as
// Atkinson Hyperlegible instead. The frame sets that before it draws, and each screen builds its
// styles again whenever the theme tokens change, which they do when the setting does.

const STANDARD = {
  sans: 'DMSans_400Regular',
  sansSemi: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  serif: 'Newsreader_600SemiBold',
} as const;

const READABLE = {
  sans: 'AtkinsonHyperlegible_400Regular',
  sansSemi: 'AtkinsonHyperlegible_700Bold',
  sansBold: 'AtkinsonHyperlegible_700Bold',
  serif: 'AtkinsonHyperlegible_700Bold',
} as const;

let readable = false;

export function setSeReadableFont(on: boolean): void {
  readable = on;
}

export const SE_FONT: { readonly sans: string; readonly sansSemi: string; readonly sansBold: string; readonly serif: string } = {
  get sans() {
    return readable ? READABLE.sans : STANDARD.sans;
  },
  get sansSemi() {
    return readable ? READABLE.sansSemi : STANDARD.sansSemi;
  },
  get sansBold() {
    return readable ? READABLE.sansBold : STANDARD.sansBold;
  },
  get serif() {
    return readable ? READABLE.serif : STANDARD.serif;
  },
};
