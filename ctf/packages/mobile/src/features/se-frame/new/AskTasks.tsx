// + New → Ask → "+ Break it into small tasks" on Android, the copy of the web's ask-tasks.tsx: with
// tasks, the ask is posted as a goal on the member's PeerProgramming board through the goal board's
// own route, where each task can be taken on its own.

import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, type StyleProp, type TextStyle } from 'react-native';
import { SE_ASK_MAX_TASKS, SE_ASK_MAX_TASK_LENGTH, SE_ASK_TASK_WORDS as T, seAskSuggestionParts, seAskTasks } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import type { SheetStyles } from './sheetStyles';

export type AskTasksState = ReturnType<typeof useAskTasks>;

export function useAskTasks() {
  const [tasks, setTasks] = useState<string[] | null>(null);
  const [posted, setPosted] = useState(false);
  // Posts the goal and answers with what went wrong, or null once it is on the board.
  async function post(title: string): Promise<string | null> {
    setPosted(false);
    try {
      await authedFetchJson('/api/peer-programming/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ title, tasks: seAskTasks(tasks ?? []) }),
      });
      setTasks(null);
      setPosted(true);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : T.failed;
    }
  }
  return { tasks, setTasks, posted, post };
}

// A suggestion with the part that matches what was typed in bold, as the board shows it.
export function SuggestionText({ sh, typed, text }: { sh: SheetStyles; typed: string; text: string }) {
  const { lead, rest } = seAskSuggestionParts(typed, text);
  return (
    <Text style={sh.suggestText}>
      {lead ? <Text style={sh.bold}>{lead}</Text> : null}
      {rest}
    </Text>
  );
}

function Dashed({ sh, label, onPress }: { sh: SheetStyles; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={sh.dashed}>
      <Text style={sh.dashedLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function TaskFields({ sh, text, tasks, onTasks }: { sh: SheetStyles; text: StyleProp<TextStyle>; tasks: string[]; onTasks: (_tasks: string[] | null) => void }) {
  const set = (index: number, value: string) => onTasks(tasks.map((task, i) => (i === index ? value : task)));
  return (
    <View style={sh.tasks}>
      <Text style={[text, sh.bold]}>{T.task}</Text>
      {tasks.map((task, index) => (
        <View key={index} style={sh.taskRow}>
          <TextInput
            accessibilityLabel={`${T.task} ${index + 1}`}
            style={[sh.pill, sh.taskInput]}
            value={task}
            maxLength={SE_ASK_MAX_TASK_LENGTH}
            onChangeText={(value) => set(index, value)}
          />
          <Text
            accessibilityRole="button"
            accessibilityLabel={`${T.remove} ${T.task.toLowerCase()} ${index + 1}`}
            onPress={() => onTasks(tasks.length > 1 ? tasks.filter((_, i) => i !== index) : null)}
            style={sh.link}
          >
            {T.remove}
          </Text>
        </View>
      ))}
      <View style={sh.taskRow}>
        {tasks.length < SE_ASK_MAX_TASKS ? <Dashed sh={sh} label={T.another} onPress={() => onTasks([...tasks, ''])} /> : null}
        <Text accessibilityRole="button" onPress={() => onTasks(null)} style={sh.link}>
          {T.none}
        </Text>
      </View>
      <Text style={text}>{T.note}</Text>
    </View>
  );
}

export function AskTasks({ sh, text, done, state }: { sh: SheetStyles; text: StyleProp<TextStyle>; done: StyleProp<TextStyle>; state: AskTasksState }) {
  return (
    <>
      {state.posted ? (
        <Text accessibilityLiveRegion="polite" style={done}>
          {T.posted}
        </Text>
      ) : null}
      {state.tasks ? <TaskFields sh={sh} text={text} tasks={state.tasks} onTasks={state.setTasks} /> : <Dashed sh={sh} label={T.add} onPress={() => state.setTasks([''])} />}
    </>
  );
}
