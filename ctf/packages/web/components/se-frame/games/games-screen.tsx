'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SE_PUZZLE_WORDS, type SePuzzle } from '@ctf/shared';
import { useSeTheme } from '../use-se-theme';
import { seThemeVars } from '../se-theme-vars';
import { PuzzlePlay } from './puzzle-play';
import { useSolved } from './use-solved';
import frame from '../se-frame.module.css';
import styles from './games.module.css';

// The puzzles screen: today's puzzles from today's stories, then every other post on the blog,
// newest first and paged. Opening one plays it in place; Next goes on through the same list.

export type GameEntry = { slug: string; title: string; url: string; puzzle: SePuzzle };

type Props = { today: GameEntry[]; rest: GameEntry[]; start: string | null; failed: string | null };

const PAGE_SIZE = 10;

function Row({ entry, solved, onOpen }: { entry: GameEntry; solved: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={styles.row} onClick={onOpen}>
      <span className={styles.rowTitle}>{entry.title}</span>
      <span className={styles.rowMeta}>
        {SE_PUZZLE_WORDS[entry.puzzle.kind].title}
        {solved ? <span className={styles.solved}>Solved</span> : null}
      </span>
    </button>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (_page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className={styles.pager} aria-label="More puzzles">
      <button type="button" className={styles.linkButton} disabled={page === 0} onClick={() => onPage(page - 1)}>
        Newer
      </button>
      <span>
        Page {page + 1} of {pages}
      </span>
      <button type="button" className={styles.linkButton} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        Older
      </button>
    </nav>
  );
}

function Lists({ today, rest, solved, onOpen }: { today: GameEntry[]; rest: GameEntry[]; solved: Set<string>; onOpen: (_slug: string) => void }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rest.length / PAGE_SIZE);
  const shown = rest.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const first = page * PAGE_SIZE + 1;
  return (
    <>
      <section className={styles.group} aria-label="Today's puzzles">
        <h2 className={styles.groupTitle}>Today&apos;s puzzles</h2>
        {today.length === 0 ? <p className={styles.text}>No stories today yet. The puzzles below are from every other post.</p> : null}
        {today.map((entry) => (
          <Row key={entry.slug} entry={entry} solved={solved.has(entry.slug)} onOpen={() => onOpen(entry.slug)} />
        ))}
      </section>
      {rest.length > 0 ? (
        <section className={styles.group} aria-label="Keep playing">
          <h2 className={styles.groupTitle}>
            Keep playing · {first}–{first + shown.length - 1} of {rest.length}
          </h2>
          {shown.map((entry) => (
            <Row key={entry.slug} entry={entry} solved={solved.has(entry.slug)} onOpen={() => onOpen(entry.slug)} />
          ))}
          <Pager page={page} pages={pages} onPage={setPage} />
        </section>
      ) : null}
    </>
  );
}

function Body({ today, rest, start, failed }: Props) {
  const all = [...today, ...rest];
  const { solved, markSolved, notKept } = useSolved();
  const [current, setCurrent] = useState<string | null>(all.some((entry) => entry.slug === start) ? start : null);
  if (failed) {
    return (
      <p role="alert" className={styles.text}>
        The puzzles could not be loaded. {failed}
      </p>
    );
  }
  const at = all.findIndex((entry) => entry.slug === current);
  if (at < 0) return <Lists today={today} rest={rest} solved={solved} onOpen={setCurrent} />;
  const entry = all[at];
  const next = all[at + 1];
  return (
    <>
      {notKept ? <p className={styles.text}>Solved puzzles are not remembered in this browser: it refused to keep them ({notKept}).</p> : null}
      <button type="button" className={styles.linkButton} onClick={() => setCurrent(null)}>
        All puzzles
      </button>
      <PuzzlePlay
        key={entry.slug}
        puzzle={entry.puzzle}
        title={entry.title}
        url={entry.url}
        onSolved={() => markSolved(entry.slug)}
        onNext={next ? () => setCurrent(next.slug) : null}
      />
    </>
  );
}

export function GamesScreen(props: Props) {
  const { theme } = useSeTheme();
  return (
    <div className={frame.frame} style={seThemeVars(theme.color, theme.mode)}>
      <main className={`${frame.screen} ${styles.screen}`}>
        <Link href="/" className={styles.linkButton}>
          Back to Today
        </Link>
        <header className={frame.header}>
          <h1 className={frame.title}>Puzzles</h1>
          <p className={frame.eyebrow}>One for each story. Built from the post itself, so playing is reading.</p>
        </header>
        <Body {...props} />
      </main>
    </div>
  );
}
