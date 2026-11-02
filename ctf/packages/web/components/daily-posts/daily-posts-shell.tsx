'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import { DAILY_POST_THEMES, type DailyPostThemeId } from 'lib/daily-posts/themes';
import { CopyRow } from './copy-row';
import { ExcludeButton } from './exclude-button';
import { TemplatesSection } from './templates-section';
import { ThemeGroup } from './theme-group';
import * as api from './api';
import type { DailyPostItem, DailyPostTemplateItem, ShellTokens, TickMap } from './types';

// The day's posting list in one place, from a phone: today's PB2 message, today's share of the blog
// rotation, the owner's templates, and the blog posts grouped by theme. Every copy control ticks
// itself off for the day, so what is already posted is visible at a glance. Nothing here changes
// the app or the blog.

type Props = {
  today: string;
  todayLabel: string;
  pb2: { title: string; pasteText: string } | null;
  pb2Error: string | null;
  rotation: DailyPostItem[];
  posts: DailyPostItem[];
  postsError: string | null;
  templates: DailyPostTemplateItem[];
  ticks: TickMap;
  storeError: string | null;
};

function Section({ t, title, note, children }: { t: ShellTokens; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 15.5, fontWeight: 700, color: t.TITLE, margin: '0 0 4px' }}>{title}</h2>
      {note && <p style={{ fontSize: 12.5, color: t.MUTED, margin: '0 0 10px', lineHeight: 1.5 }}>{note}</p>}
      {children}
    </section>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" style={{ fontSize: 12.5, color: '#F87171', margin: '0 0 10px' }}>
      {text}
    </p>
  );
}

export function DailyPostsShell(props: Props) {
  const { today, todayLabel, pb2, pb2Error, rotation, postsError, templates, storeError } = props;
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('fireside', theme), theme);
  const [ticks, setTicks] = useState<TickMap>(props.ticks);
  const [posts, setPosts] = useState(props.posts);

  const onTick = useCallback(
    async (itemKey: string, done: boolean): Promise<string | null> => {
      const result = await api.saveTick(itemKey, today, done);
      if (!result.ok) return result.message;
      setTicks((current) => {
        const days = (current[itemKey] ?? []).filter((day) => day !== today);
        return { ...current, [itemKey]: done ? [today, ...days] : days };
      });
      return null;
    },
    [today],
  );

  const onThemes = useCallback(async (slug: string, themes: DailyPostThemeId[] | null): Promise<string | null> => {
    const result = await api.saveThemeChoice(slug, themes);
    if (!result.ok) return result.message;
    setPosts((current) =>
      current.map((post) => (post.slug === slug ? { ...post, themes: themes ?? post.linkThemes, chosen: themes !== null } : post)),
    );
    return null;
  }, []);

  const onExclude = useCallback(async (slug: string, excluded: boolean): Promise<string | null> => {
    const result = await api.saveExclusion(slug, excluded);
    if (!result.ok) return result.message;
    setPosts((current) => current.map((post) => (post.slug === slug ? { ...post, excluded } : post)));
    return null;
  }, []);
  const leaveOut = useCallback((slug: string) => onExclude(slug, true), [onExclude]);

  const inRotation = useMemo(() => posts.filter((post) => !post.excluded), [posts]);
  const leftOut = useMemo(() => posts.filter((post) => post.excluded), [posts]);
  const unsorted = useMemo(() => inRotation.filter((post) => post.themes.length === 0), [inRotation]);
  const todays = rotation.filter((post) => !leftOut.some((out) => out.slug === post.slug));
  const doneOf = (key: string) => (ticks[key] ?? [])[0] === today;

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader title="Daily Posts" accent={t.ACCENT} icon={<ListChecks size={18} color={t.ACCENT} />} backHref="/admin" />
      <div style={{ padding: '14px 16px 40px', maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 18px', lineHeight: 1.55 }}>
          {todayLabel}. Copy ticks a post off for today; tap the tick to take it back.
        </p>
        {storeError && <ErrorLine text={`Ticks and templates could not be read: ${storeError}`} />}

        <Section t={t} title="PB2 Message of the Day" note={<Link href="/admin/quora-message-of-the-day" style={{ color: t.ACCENT }}>See the coming days</Link>}>
          {pb2Error && <ErrorLine text={pb2Error} />}
          {pb2 && <CopyRow t={t} label={pb2.title} text={pb2.pasteText} doneToday={doneOf('pb2')} onTick={(done) => onTick('pb2', done)} />}
        </Section>

        <Section t={t} title="Today's blog posts" note="Every post comes round once in 30 days, so a reader who visits within 30 days sees them all.">
          {postsError && <ErrorLine text={postsError} />}
          <div style={{ display: 'grid', gap: 6 }}>
            {todays.map((post) => (
              <CopyRow
                key={post.slug}
                t={t}
                label={`No. ${post.number}`}
                text={post.pasteText}
                doneToday={doneOf(`post:${post.slug}`)}
                onTick={(done) => onTick(`post:${post.slug}`, done)}
              >
                <ExcludeButton t={t} label="Leave out of rotation" onPress={() => leaveOut(post.slug)} />
              </CopyRow>
            ))}
          </div>
        </Section>

        <Section t={t} title="Templates" note="Posts that are not on the blog, saved for reuse.">
          <TemplatesSection t={t} initial={templates} today={today} ticks={ticks} onTick={onTick} />
        </Section>

        <Section t={t} title="Themes" note="Each post sits in every group whose part of the app it links. Unsorted posts link none: tick their groups and Save. Next is where the group's last posting day stopped.">
          {unsorted.length > 0 && (
            <ThemeGroup t={t} label="Unsorted" sorting posts={unsorted} today={today} ticks={ticks} onTick={onTick} onThemes={onThemes} onExclude={leaveOut} />
          )}
          {DAILY_POST_THEMES.map((group) => (
            <ThemeGroup
              key={group.id}
              t={t}
              label={group.label}
              posts={inRotation.filter((post) => post.themes.includes(group.id))}
              today={today}
              ticks={ticks}
              onTick={onTick}
              onThemes={onThemes}
              onExclude={leaveOut}
            />
          ))}
        </Section>

        {leftOut.length > 0 && (
          <Section t={t} title="Left out" note="Out of the rotation, the groups and Today's stories. They stay on the blog.">
            <div style={{ display: 'grid', gap: 6 }}>
              {leftOut.map((post) => (
                <div key={post.slug} style={{ background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 13, color: t.TEXT }}>
                    No. {post.number} · {post.title}
                  </div>
                  <ExcludeButton t={t} label="Bring back" onPress={() => onExclude(post.slug, false)} />
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
