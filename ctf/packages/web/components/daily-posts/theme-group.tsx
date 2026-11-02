'use client';

import { useState } from 'react';
import type { DailyPostThemeId } from 'lib/daily-posts/themes';
import { CopyRow } from './copy-row';
import { ThemePicker } from './theme-picker';
import type { DailyPostItem, ShellTokens, TickMap } from './types';

// One theme: its posts in number order, each with the last day it was posted. "Next" marks the
// post after the one posted most recently in this group, so a themed day picks up where the last
// one stopped. Paged, never one long list (accessibility rule, rule 100).
//
// Unsorted (sorting) opens by default with every post's group choices showing, so a post is placed
// with a tick and Save, and leaves Unsorted once it is in a group.

const PAGE_SIZE = 15;

type Props = {
  t: ShellTokens;
  label: string;
  posts: DailyPostItem[];
  today: string;
  ticks: TickMap;
  onTick: (itemKey: string, done: boolean) => Promise<string | null>;
  onThemes: (slug: string, themes: DailyPostThemeId[] | null) => Promise<string | null>;
  sorting?: boolean;
  onExclude?: (slug: string) => Promise<string | null>;
};

function nextIndex(posts: DailyPostItem[], ticks: TickMap): number {
  let latest = '';
  let latestIndex = -1;
  posts.forEach((post, index) => {
    const day = ticks[`post:${post.slug}`]?.[0] ?? '';
    if (day && day >= latest) {
      latest = day;
      latestIndex = index;
    }
  });
  return posts.length === 0 ? -1 : (latestIndex + 1) % posts.length;
}

export function ThemeGroup({ t, label, posts, today, ticks, onTick, onThemes, onExclude, sorting = false }: Props) {
  const next = nextIndex(posts, ticks);
  const pages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const [page, setPage] = useState(next >= 0 ? Math.floor(next / PAGE_SIZE) : 0);
  const [editing, setEditing] = useState<string | null>(null);
  const current = Math.min(page, pages - 1);
  const shown = posts.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const pagerButton = {
    background: t.INPUT_BG,
    color: t.TEXT,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12.5,
    cursor: 'pointer',
  } as const;

  return (
    <details open={sorting} style={{ marginBottom: 8, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 12, padding: '10px 12px', background: t.SURFACE }}>
      <summary style={{ cursor: 'pointer', fontSize: 14.5, fontWeight: 700, color: t.TITLE }}>
        {label} <span style={{ fontWeight: 500, color: t.MUTED, fontSize: 12.5 }}>· {posts.length}</span>
      </summary>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {posts.length === 0 && <p style={{ fontSize: 12.5, color: t.MUTED, margin: 0 }}>No posts in this group yet.</p>}
        {shown.map((post) => {
          const days = ticks[`post:${post.slug}`] ?? [];
          const isNext = posts.indexOf(post) === next;
          return (
            <CopyRow
              key={post.slug}
              t={t}
              label={
                <span>
                  No. {post.number}
                  {isNext && <span style={{ marginLeft: 8, fontSize: 11.5, color: t.ACCENT }}>Next</span>}
                </span>
              }
              text={post.pasteText}
              doneToday={days[0] === today}
              lastDone={days[0] ?? null}
              highlight={isNext}
              onTick={(done) => onTick(`post:${post.slug}`, done)}
            >
              {sorting ? (
                <ThemePicker t={t} post={post} onSave={(themes) => onThemes(post.slug, themes)} onExclude={onExclude ? () => onExclude(post.slug) : undefined} />
              ) : editing === post.slug ? (
                <ThemePicker
                  t={t}
                  post={post}
                  onSave={(themes) => onThemes(post.slug, themes)}
                  onClose={() => setEditing(null)}
                  onExclude={onExclude ? () => onExclude(post.slug) : undefined}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(post.slug)}
                  style={{ background: 'none', border: 'none', color: t.MUTED, fontSize: 11.5, padding: '4px 0 0', cursor: 'pointer' }}
                >
                  Groups{post.chosen ? ' (set by hand)' : ''}
                </button>
              )}
            </CopyRow>
          );
        })}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
            <button type="button" style={pagerButton} disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            <span style={{ fontSize: 12, color: t.MUTED }}>
              {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, posts.length)} of {posts.length}
            </span>
            <button type="button" style={pagerButton} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next page
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
