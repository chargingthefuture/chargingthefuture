import type { DailyPostThemeId } from 'lib/daily-posts/themes';
import type { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';

export type ShellTokens = ReturnType<typeof getPluginShellTokens>;

export type DailyPostItem = {
  number: number;
  slug: string;
  title: string;
  pasteText: string;
  /** The groups the post appears in: the owner's choice when there is one, else its own links'. */
  themes: DailyPostThemeId[];
  /** The groups its own links put it in, shown when the owner edits the choice. */
  linkThemes: DailyPostThemeId[];
  chosen: boolean;
  /** Left out of the rotation, its theme groups and Today's stories; it stays on the blog. */
  excluded: boolean;
};

export type DailyPostTemplateItem = { id: string; title: string; body: string };

/** item_key → days ticked, newest first. */
export type TickMap = Record<string, string[]>;

export type DailyBlurbItem = { id: string; lineLabel: string; text: string; pasteText: string };

export type DailyLiveItem = { id: string; lineLabel: string; title: string; points: string[]; pasteText: string };
