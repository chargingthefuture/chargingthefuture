// The three puzzles of the day on Android, copies of the web's word-play.tsx, picture-play.tsx and
// ladder-play.tsx: the same rules from the same shared code.

import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { seCheckLadderStep, seLadderPath, sePictureSolved, type SeDailyPuzzle, type SeDailyWord, type SeThemeTokens } from '@ctf/shared';
import { SceneSvg } from './SceneSvg';
import type { GameStyles } from './styles';

type Done = (_result: number) => void;

export function WordCard({ s, word }: { s: GameStyles; word: SeDailyWord }) {
  return (
    <View style={s.list}>
      <Text style={s.bigWord}>{word.word}</Text>
      <Text style={s.ask}>
        ({word.part}) {word.meaning}
      </Text>
      <Text style={s.text}>{word.sentence}</Text>
    </View>
  );
}

export function WordPlay({ s, puzzle, onDone }: { s: GameStyles; puzzle: Extract<SeDailyPuzzle, { kind: 'word' }>; onDone: Done }) {
  const [wrong, setWrong] = useState<number[]>([]);
  const pick = (index: number) => {
    if (index === puzzle.answer) return onDone(wrong.length + 1);
    setWrong((current) => [...current, index]);
  };
  return (
    <>
      <Text style={s.quote}>{puzzle.word.meaning}</Text>
      <View style={s.list}>
        {puzzle.choices.map((choice, index) => (
          <TouchableOpacity
            key={choice}
            accessibilityRole="button"
            disabled={wrong.includes(index)}
            style={[s.choice, wrong.includes(index) ? s.wrong : null]}
            onPress={() => pick(index)}
          >
            <Text style={s.choiceText}>{choice}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {wrong.length > 0 ? <Text style={s.ask}>Not that one. Try another.</Text> : null}
    </>
  );
}

export function PicturePlay({ s, puzzle, onDone }: { s: GameStyles; puzzle: Extract<SeDailyPuzzle, { kind: 'picture' }>; onDone: Done }) {
  const [order, setOrder] = useState(puzzle.order);
  const [picked, setPicked] = useState<number | null>(null);
  const [swaps, setSwaps] = useState(0);
  const tap = (at: number) => {
    if (picked === null) return setPicked(at);
    if (picked === at) return setPicked(null);
    const next = [...order];
    [next[picked], next[at]] = [next[at], next[picked]];
    setOrder(next);
    setPicked(null);
    setSwaps(swaps + 1);
    if (sePictureSolved(next)) onDone(swaps + 1);
  };
  return (
    <View style={s.list}>
      {order.map((strip, at) => (
        <TouchableOpacity
          key={strip}
          accessibilityRole="button"
          accessibilityLabel={`Strip ${at + 1}${picked === at ? ', picked' : ''}`}
          accessibilityState={{ selected: picked === at }}
          style={[s.strip, picked === at ? s.stripPicked : null]}
          onPress={() => tap(at)}
        >
          <SceneSvg shapes={puzzle.scene.shapes} strip={strip} />
        </TouchableOpacity>
      ))}
      <Text style={s.text}>
        {swaps} swap{swaps === 1 ? '' : 's'} so far
      </Text>
    </View>
  );
}

function Rung({ s, word, end }: { s: GameStyles; word: string; end?: boolean }) {
  return <Text style={[s.rung, end ? s.rungEnd : null]}>{word.toUpperCase()}</Text>;
}

type LadderProps = { s: GameStyles; t: SeThemeTokens; puzzle: Extract<SeDailyPuzzle, { kind: 'ladder' }>; onDone: Done };

export function LadderPlay({ s, t, puzzle, onDone }: LadderProps) {
  const [steps, setSteps] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const last = steps[steps.length - 1] ?? puzzle.start;
  const add = () => {
    const check = seCheckLadderStep(last, typed);
    if ('reason' in check) return setNote(check.reason);
    const word = typed.trim().toLowerCase();
    setSteps([...steps, word]);
    setTyped('');
    setNote(null);
    if (word === puzzle.end) onDone(steps.length + 1);
  };
  const hint = () => {
    const path = seLadderPath(last, puzzle.end);
    setNote(path && path[1] ? `Try ${path[1].toUpperCase()}.` : 'No way from here. Undo a step.');
  };
  return (
    <>
      <View style={s.ladder}>
        <Rung s={s} word={puzzle.start} />
        {steps.map((word, i) => (
          <Rung key={`${word}-${i}`} s={s} word={word} />
        ))}
        <Rung s={s} word={puzzle.end} end />
      </View>
      <View style={s.form}>
        <TextInput
          accessibilityLabel={`Next word after ${last.toUpperCase()}`}
          style={s.input}
          value={typed}
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={last.toUpperCase()}
          placeholderTextColor={t.soft}
          onChangeText={(value) => setTyped(value.replace(/[^a-zA-Z]/g, ''))}
          onSubmitEditing={add}
        />
        <TouchableOpacity accessibilityRole="button" style={s.primary} onPress={add}>
          <Text style={s.primaryText}>Add</Text>
        </TouchableOpacity>
      </View>
      {note ? (
        <Text accessibilityLiveRegion="polite" style={s.ask}>
          {note}
        </Text>
      ) : null}
      <View style={s.row}>
        <TouchableOpacity accessibilityRole="button" disabled={steps.length === 0} style={s.linkButton} onPress={() => setSteps(steps.slice(0, -1))}>
          <Text style={[s.link, steps.length === 0 ? s.dim : null]}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={s.linkButton} onPress={hint}>
          <Text style={s.link}>Hint</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.text}>With everyday words it takes {puzzle.shortest} steps. Any number of steps finishes it.</Text>
    </>
  );
}
