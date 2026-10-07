// Theme tokens plus the PeerProgramming accent, read once by each PeerProgramming component.
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

export type PPTheme = { tokens: ThemeTokens; accent: string };

export function usePPTheme(): PPTheme {
  const { tokens, theme } = useTheme();
  return { tokens, accent: getAppAccent('peer-programming', theme) };
}
