// One puzzle being played, the Android copy of the web's puzzle-play.tsx. A choice puzzle is
// answered with one tap; a line-order puzzle by tapping the lines in turn. Either way the result
// shows with the post and the next puzzle.

import React, { useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { SE_PUZZLE_WORDS, sePuzzleSolved, type SePuzzle } from '@ctf/shared';
import type { GameStyles } from './styles';

type Done = (_right: boolean) => void;

function Choices({ s, puzzle, onDone }: { s: GameStyles; puzzle: Extract<SePuzzle, { choices: string[] }>; onDone: Done }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (index: number) => {
    if (picked !== null) return;
    setPicked(index);
    onDone(sePuzzleSolved(puzzle, index));
  };
  const styleOf = (index: number) => {
    if (picked === null) return s.choice;
    if (index === puzzle.answer) return [s.choice, s.right];
    return index === picked ? [s.choice, s.wrong] : s.choice;
  };
  return (
    <View style={s.list}>
      {puzzle.choices.map((choice, index) => (
        <TouchableOpacity key={index} accessibilityRole="button" disabled={picked !== null} style={styleOf(index)} onPress={() => pick(index)}>
          <Text style={s.choiceText}>{choice}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Lines({ s, puzzle, onDone }: { s: GameStyles; puzzle: Extract<SePuzzle, { kind: 'line-order' }>; onDone: Done }) {
  const [tapped, setTapped] = useState<number[]>([]);
  const [shown, setShown] = useState(false);
  const order = shown ? puzzle.order : tapped;
  const tap = (index: number) => {
    if (shown || tapped.includes(index)) return;
    const next = [...tapped, index];
    setTapped(next);
    if (next.length < puzzle.lines.length) return;
    const right = sePuzzleSolved(puzzle, next);
    setShown(!right);
    onDone(right);
  };
  return (
    <View style={s.list}>
      {puzzle.lines.map((line, index) => {
        const at = order.indexOf(index);
        return (
          <TouchableOpacity key={index} accessibilityRole="button" disabled={at >= 0} style={[s.choice, s.line]} onPress={() => tap(index)}>
            <Text style={s.lineNumber}>{at >= 0 ? at + 1 : ''}</Text>
            <Text style={[s.choiceText, s.lineText]}>{line}</Text>
          </TouchableOpacity>
        );
      })}
      {tapped.length > 0 && tapped.length < puzzle.lines.length ? (
        <TouchableOpacity accessibilityRole="button" style={s.linkButton} onPress={() => setTapped([])}>
          <Text style={s.link}>Start the order again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Prompt({ s, puzzle }: { s: GameStyles; puzzle: SePuzzle }) {
  if (puzzle.kind === 'missing-word') {
    return (
      <Text style={s.quote}>
        {puzzle.before}
        <Text style={s.gap}>_____</Text>
        {puzzle.after}
      </Text>
    );
  }
  if (puzzle.kind === 'which-post') return <Text style={s.quote}>{puzzle.excerpt}</Text>;
  return null;
}

function resultLine(right: boolean, puzzle: SePuzzle): string {
  if (right) return 'Right.';
  return puzzle.kind === 'line-order' ? 'Not quite. The numbers show the order the post has.' : 'Not quite. The right one is marked.';
}

type Props = { s: GameStyles; puzzle: SePuzzle; title: string; url: string; onSolved: () => void; onNext: (() => void) | null };

export function PuzzlePlay({ s, puzzle, title, url, onSolved, onNext }: Props) {
  const [result, setResult] = useState<boolean | null>(null);
  const words = SE_PUZZLE_WORDS[puzzle.kind];
  const done = (right: boolean) => {
    setResult(right);
    if (right) onSolved();
  };
  return (
    <View style={s.play} accessibilityLabel={words.title}>
      <Text style={s.kind}>{words.title.toUpperCase()}</Text>
      <Text style={s.ask}>{words.ask}</Text>
      <Prompt s={s} puzzle={puzzle} />
      {puzzle.kind === 'line-order' ? <Lines s={s} puzzle={puzzle} onDone={done} /> : <Choices s={s} puzzle={puzzle} onDone={done} />}
      {result === null ? null : (
        <View style={s.result} accessibilityLiveRegion="polite">
          <Text style={s.resultTitle}>{resultLine(result, puzzle)}</Text>
          <Text style={s.ask}>From: {title}</Text>
          <View style={s.row}>
            <TouchableOpacity accessibilityRole="link" style={s.secondary} onPress={() => void Linking.openURL(url)}>
              <Text style={s.secondaryText}>Read the post</Text>
            </TouchableOpacity>
            {onNext ? (
              <TouchableOpacity accessibilityRole="button" style={s.primary} onPress={onNext}>
                <Text style={s.primaryText}>Next puzzle</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}
