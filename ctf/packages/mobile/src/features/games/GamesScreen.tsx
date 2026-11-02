// The puzzles screen, the Android copy of the web's /games: today's puzzles from today's stories,
// then every other post on the blog, newest first and paged. Opening one plays it in place; Next
// goes on through the same list.

import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SE_PUZZLE_WORDS, seTheme } from '@ctf/shared';
import { useSeTheme } from '../se-frame/useSeTheme';
import { PuzzlePlay } from './PuzzlePlay';
import { makeGameStyles, type GameStyles } from './styles';
import { useGamePosts, type GameEntry } from './useGamePosts';
import { useSolved } from './useSolved';
import { takePendingStory } from './pending';

const PAGE_SIZE = 10;

function Row({ s, entry, solved, onOpen }: { s: GameStyles; entry: GameEntry; solved: boolean; onOpen: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" style={s.card} onPress={onOpen}>
      <Text style={s.rowTitle}>{entry.title}</Text>
      <View style={s.rowMeta}>
        <Text style={s.meta}>{SE_PUZZLE_WORDS[entry.puzzle.kind].title}</Text>
        {solved ? <Text style={s.solved}>Solved</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function Pager({ s, page, pages, onPage }: { s: GameStyles; page: number; pages: number; onPage: (_page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <View style={s.pager} accessibilityLabel="More puzzles">
      <TouchableOpacity accessibilityRole="button" disabled={page === 0} style={s.linkButton} onPress={() => onPage(page - 1)}>
        <Text style={[s.link, page === 0 ? { opacity: 0.4 } : null]}>Newer</Text>
      </TouchableOpacity>
      <Text style={s.meta}>
        Page {page + 1} of {pages}
      </Text>
      <TouchableOpacity accessibilityRole="button" disabled={page >= pages - 1} style={s.linkButton} onPress={() => onPage(page + 1)}>
        <Text style={[s.link, page >= pages - 1 ? { opacity: 0.4 } : null]}>Older</Text>
      </TouchableOpacity>
    </View>
  );
}

type ListsProps = { s: GameStyles; today: GameEntry[]; rest: GameEntry[]; solved: Set<string>; onOpen: (_slug: string) => void };

function Lists({ s, today, rest, solved, onOpen }: ListsProps) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rest.length / PAGE_SIZE);
  const shown = rest.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const first = page * PAGE_SIZE + 1;
  return (
    <>
      <View style={s.group}>
        <Text style={s.groupTitle}>Today&apos;s puzzles</Text>
        {today.length === 0 ? <Text style={s.ask}>No stories today yet. The puzzles below are from every other post.</Text> : null}
        {today.map((entry) => (
          <Row key={entry.slug} s={s} entry={entry} solved={solved.has(entry.slug)} onOpen={() => onOpen(entry.slug)} />
        ))}
      </View>
      {rest.length > 0 ? (
        <View style={s.group}>
          <Text style={s.groupTitle}>
            Keep playing · {first}–{first + shown.length - 1} of {rest.length}
          </Text>
          {shown.map((entry) => (
            <Row key={entry.slug} s={s} entry={entry} solved={solved.has(entry.slug)} onOpen={() => onOpen(entry.slug)} />
          ))}
          <Pager s={s} page={page} pages={pages} onPage={setPage} />
        </View>
      ) : null}
    </>
  );
}

type PlayingProps = { s: GameStyles; all: GameEntry[]; current: string; setCurrent: (_slug: string | null) => void; markSolved: (_slug: string) => void };

function Playing({ s, all, current, setCurrent, markSolved }: PlayingProps) {
  const at = all.findIndex((entry) => entry.slug === current);
  const entry = all[at];
  const next = all[at + 1];
  return (
    <>
      <TouchableOpacity accessibilityRole="button" style={s.linkButton} onPress={() => setCurrent(null)}>
        <Text style={s.link}>All puzzles</Text>
      </TouchableOpacity>
      <PuzzlePlay
        key={entry.slug}
        s={s}
        puzzle={entry.puzzle}
        title={entry.title}
        url={entry.url}
        onSolved={() => markSolved(entry.slug)}
        onNext={next ? () => setCurrent(next.slug) : null}
      />
    </>
  );
}

function Body({ s }: { s: GameStyles }) {
  const { state, reload } = useGamePosts();
  const { solved, markSolved, notKept } = useSolved();
  const [current, setCurrent] = useState<string | null>(() => takePendingStory());
  const all = useMemo(() => (state.kind === 'ready' ? [...state.today, ...state.rest] : []), [state]);
  if (state.kind === 'loading') return <Text style={s.ask}>Loading the puzzles…</Text>;
  if (state.kind === 'error') {
    return (
      <View style={s.group}>
        <Text accessibilityRole="alert" style={s.ask}>
          The puzzles could not be loaded. {state.message}
        </Text>
        <TouchableOpacity accessibilityRole="button" style={s.linkButton} onPress={() => void reload()}>
          <Text style={s.link}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const playing = current !== null && all.some((entry) => entry.slug === current);
  return (
    <>
      {notKept ? <Text style={s.ask}>Solved puzzles are not remembered on this phone: it refused to keep them ({notKept}).</Text> : null}
      {playing ? (
        <Playing s={s} all={all} current={current} setCurrent={setCurrent} markSolved={markSolved} />
      ) : (
        <Lists s={s} today={state.today} rest={state.rest} solved={solved} onOpen={setCurrent} />
      )}
    </>
  );
}

export function GamesScreen() {
  const { theme } = useSeTheme();
  const s = makeGameStyles(seTheme(theme.color, theme.mode));
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View>
        <Text accessibilityRole="header" style={s.title}>
          Puzzles
        </Text>
        <Text style={s.eyebrow}>One for each story. Built from the post itself, so playing is reading.</Text>
      </View>
      <Body s={s} />
    </ScrollView>
  );
}
