// Theme tokens plus the Foundation accent, read once by each Foundation component.
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

export type FDTheme = { tokens: ThemeTokens; accent: string };

export function useFDTheme(): FDTheme {
  const { tokens, theme } = useTheme();
  return { tokens, accent: getAppAccent('foundation', theme) };
}
