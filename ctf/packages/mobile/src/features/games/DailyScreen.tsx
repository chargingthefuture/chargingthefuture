// The puzzle of the day on Android, the copy of the web's /games (daily-screen.tsx): one puzzle, the
// same for everyone, taking turns between the word of the day, the picture of the day and the word
// ladder. No timer, no streak, no ranking, and no way to fail.

import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SE_DAILY_TITLES, seDailyPuzzle, seDailyShareText, seLadderPath, seTheme, type SeDailyPuzzle, type SeThemeTokens } from '@ctf/shared';
import { useSeTheme } from '../se-frame/useSeTheme';
import { LadderPlay, PicturePlay, WordCard, WordPlay } from './Plays';
import { SceneSvg } from './SceneSvg';
import { makeGameStyles, type GameStyles } from './styles';
import { useDailyProgress } from './useDailyProgress';

function tomorrow(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

function Play({ s, t, puzzle, onDone }: { s: GameStyles; t: SeThemeTokens; puzzle: SeDailyPuzzle; onDone: (_result: number) => void }) {
  if (puzzle.kind === 'word') return <WordPlay s={s} puzzle={puzzle} onDone={onDone} />;
  if (puzzle.kind === 'picture') return <PicturePlay s={s} puzzle={puzzle} onDone={onDone} />;
  return <LadderPlay s={s} t={t} puzzle={puzzle} onDone={onDone} />;
}

function Answer({ s, puzzle }: { s: GameStyles; puzzle: SeDailyPuzzle }) {
  if (puzzle.kind === 'word') return <WordCard s={s} word={puzzle.word} />;
  if (puzzle.kind === 'picture') {
    return (
      <View style={s.list}>
        <View style={s.fullPicture} accessibilityRole="image" accessibilityLabel={puzzle.scene.name}>
          <SceneSvg shapes={puzzle.scene.shapes} />
        </View>
        <Text style={s.text}>{puzzle.scene.name}</Text>
      </View>
    );
  }
  const path = seLadderPath(puzzle.start, puzzle.end) ?? [];
  return <Text style={s.text}>One short way: {path.map((word) => word.toUpperCase()).join(' → ')}</Text>;
}

function Done({ s, puzzle, result }: { s: GameStyles; puzzle: SeDailyPuzzle; result: number }) {
  const [copied, setCopied] = useState<string | null>(null);
  const share = seDailyShareText(puzzle, result);
  const copy = () => {
    Clipboard.setStringAsync(share)
      .then(() => setCopied('Copied.'))
      .catch((error: unknown) => setCopied(`Not copied: ${error instanceof Error ? error.message : String(error)}.`));
  };
  return (
    <View style={s.result} accessibilityLiveRegion="polite">
      <Text style={s.resultTitle}>Done.</Text>
      <Answer s={s} puzzle={puzzle} />
      <Text selectable style={s.shareLine}>
        {share}
      </Text>
      <TouchableOpacity accessibilityRole="button" style={[s.primary, { alignSelf: 'flex-start' }]} onPress={copy}>
        <Text style={s.primaryText}>Copy to share</Text>
      </TouchableOpacity>
      {copied ? <Text style={s.text}>{copied}</Text> : null}
      <Text style={s.text}>Tomorrow: {SE_DAILY_TITLES[seDailyPuzzle(tomorrow(puzzle.day)).kind].title.toLowerCase()}.</Text>
    </View>
  );
}

export function DailyScreen() {
  const { theme } = useSeTheme();
  const t = seTheme(theme.color, theme.mode);
  const s = makeGameStyles(t);
  const [day] = useState(() => new Date().toISOString().slice(0, 10));
  const puzzle = seDailyPuzzle(day);
  const { result, finish, notKept } = useDailyProgress(day);
  const words = SE_DAILY_TITLES[puzzle.kind];
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={s.eyebrow}>Puzzle of the day · No. {puzzle.number}</Text>
        <Text accessibilityRole="header" style={s.title}>
          {words.title}
        </Text>
      </View>
      {result === null ? (
        <View style={s.play}>
          <Text style={s.ask}>{words.ask}</Text>
          <Play s={s} t={t} puzzle={puzzle} onDone={finish} />
        </View>
      ) : (
        <Done s={s} puzzle={puzzle} result={result} />
      )}
      {notKept ? <Text style={s.text}>This phone refused to remember the result ({notKept}).</Text> : null}
    </ScrollView>
  );
}
