import { redirect } from 'next/navigation';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { DailyPostsShell } from '@/components/daily-posts/daily-posts-shell';
import type { DailyPostItem, DailyPostTemplateItem, TickMap } from '@/components/daily-posts/types';
import { motdProtestDay, motdToday, quoraMotdFor } from 'lib/quora-motd/select';
import { motdDayLine } from 'lib/quora-motd/types';
import { blogPostPasteText, readBlogPosts } from 'lib/daily-posts/source';
import { rotationFor } from 'lib/daily-posts/rotation';
import { themesFromText, type DailyPostThemeId } from 'lib/daily-posts/themes';
import { listExclusions, listTemplates, listThemeChoices, listTicks } from 'lib/daily-posts/repository';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';

// Admin-only: the owner's daily posting list. The blog posts are public already; the PB2 messages
// and templates are not, for the reason given on the PB2 page.

export const dynamic = 'force-dynamic';

function label(date: string): string {
  const [y, m, d] = date.split('-').map((part) => Number.parseInt(part, 10));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

async function readStore(): Promise<
  | { ok: true; ticks: Map<string, string[]>; templates: DailyPostTemplateItem[]; choices: Map<string, DailyPostThemeId[]>; excluded: Set<string> }
  | { ok: false; reason: string }
> {
  try {
    const [ticks, templates, choices, excluded] = await Promise.all([listTicks(), listTemplates(), listThemeChoices(), listExclusions()]);
    return { ok: true, ticks, templates: templates.map(({ id, title, body }) => ({ id, title, body })), choices, excluded };
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'read' });
    return { ok: false, reason: failureReason(error) };
  }
}

type BlogRead = Awaited<ReturnType<typeof readBlogPosts>>;
type StoreRead = Awaited<ReturnType<typeof readStore>>;

// Each blog post with its paste text, its theme groups and whether it is left out.
function postItems(blog: BlogRead, store: StoreRead): DailyPostItem[] {
  if (!blog.ok) return [];
  const choices = store.ok ? store.choices : new Map<string, DailyPostThemeId[]>();
  const excluded = store.ok ? store.excluded : new Set<string>();
  return blog.posts.map((post) => {
    const linkThemes = themesFromText(post.text);
    const chosen = choices.get(post.slug);
    return {
      number: post.number,
      slug: post.slug,
      title: post.title,
      pasteText: blogPostPasteText(post),
      themes: chosen ?? linkThemes,
      linkThemes,
      chosen: chosen !== undefined,
      excluded: excluded.has(post.slug),
    };
  });
}

export default async function DailyPostsPage() {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed || !access.isAdmin) {
    redirect('/apps');
  }

  const now = new Date();
  const today = motdToday(now);

  let pb2: { title: string; pasteText: string } | null = null;
  let pb2Error: string | null = null;
  try {
    const message = quoraMotdFor(today).message;
    pb2 = { title: message.title, pasteText: `${motdDayLine(motdProtestDay(now))}\n\n${message.title}\n\n${message.body}` };
  } catch (error) {
    pb2Error = `Today's PB2 message could not be picked: ${failureReason(error)}`;
  }

  const [blog, store] = await Promise.all([readBlogPosts(), readStore()]);
  const posts = postItems(blog, store);
  const ticks: TickMap = store.ok ? Object.fromEntries(store.ticks) : {};

  return (
    <DailyPostsShell
      today={today}
      todayLabel={label(today)}
      pb2={pb2}
      pb2Error={pb2Error}
      rotation={rotationFor(posts, today).filter((post) => !post.excluded)}
      posts={posts}
      postsError={blog.ok ? null : blog.reason}
      templates={store.ok ? store.templates : []}
      ticks={ticks}
      storeError={store.ok ? null : store.reason}
    />
  );
}
