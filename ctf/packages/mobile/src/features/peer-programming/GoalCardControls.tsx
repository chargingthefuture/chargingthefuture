// What a member can do with one card, the same as the web board (pp-goals-parts.tsx):
//   - the goal's owner: "It helped" / "Keep" / "Send back" on a finished card; Edit and Remove on
//     an open card; Remove on a held card.
//   - anyone else: "Take it" on an open card; "Post result" and "Let it go" on a card they hold.
// Only "It helped" counts toward the Weavers of the Commons badge and the daily count.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { interFamily } from '../../components/ui';
import type { BoardTask, TaskAction } from './PeerProgrammingApi';
import { formatHoldDeadline } from './ppBoard';
import { PPButton, PPTextBox } from './PPButton';
import { usePPTheme } from './usePPTheme';

export type CardControlProps = {
  task: BoardTask;
  isOwner: boolean;
  viewerUserId: string;
  busy: boolean;
  taskHoldHours: number;
  onAction: (_taskId: string, _action: TaskAction, _result?: string) => void;
  onEditTask: (_taskId: string, _description: string) => Promise<boolean>;
};

// Fix the words on your own open card. A failed save (somebody took it a moment before) keeps the
// box open with your words so nothing is lost.
function EditCard({ task, busy, onEditTask, onDone }: CardControlProps & { onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(task.description);
  const save = () => {
    setSaving(true);
    void onEditTask(task.id, draft).then((ok) => {
      setSaving(false);
      if (ok) onDone();
    });
  };
  return (
    <View style={styles.stack}>
      <PPTextBox value={draft} onChange={setDraft} lines={2} maxLength={300} placeholder="Fix the words on this card" />
      <View style={styles.row}>
        <PPButton label={saving ? 'Saving…' : 'Save'} primary disabled={busy || saving || draft.trim().length === 0} onPress={save} />
        <PPButton label="Cancel" disabled={busy || saving} onPress={onDone} />
      </View>
    </View>
  );
}

function OwnerControls(props: CardControlProps) {
  const { task, busy, onAction } = props;
  const [editing, setEditing] = useState(false);
  if (task.status === 'finished') {
    return (
      <View style={styles.row}>
        <PPButton label="It helped" primary disabled={busy} onPress={() => onAction(task.id, 'helped')} />
        <PPButton label="Keep" disabled={busy} onPress={() => onAction(task.id, 'keep')} />
        <PPButton label="Send back" disabled={busy} onPress={() => onAction(task.id, 'send_back')} />
      </View>
    );
  }
  if (task.status === 'open' && editing) {
    return <EditCard {...props} onDone={() => setEditing(false)} />;
  }
  if (task.status === 'open') {
    return (
      <View style={styles.row}>
        <PPButton label="Edit" disabled={busy} onPress={() => setEditing(true)} />
        <PPButton label="Remove" disabled={busy} onPress={() => onAction(task.id, 'remove')} />
      </View>
    );
  }
  if (task.status === 'taken') {
    return <PPButton label="Remove" disabled={busy} onPress={() => onAction(task.id, 'remove')} />;
  }
  return null;
}

function HelperControls({ task, viewerUserId, busy, taskHoldHours, onAction }: CardControlProps) {
  const t = usePPTheme();
  const [result, setResult] = useState('');
  if (task.status === 'open') {
    return (
      <View style={styles.takeStack}>
        <PPButton label="Take it" primary disabled={busy} onPress={() => onAction(task.id, 'take')} />
        <Text style={[styles.takeNote, { color: t.MUTED }]}>
          Post a result within {taskHoldHours} hours of taking it, or it goes back to Up for grabs for someone else.
        </Text>
      </View>
    );
  }
  if (task.status !== 'taken' || task.takenByUserId !== viewerUserId) return null;
  return (
    <View style={styles.stack}>
      {task.takenAtIso ? (
        <Text style={[styles.note, { color: t.SUBTLE }]}>
          Post by {formatHoldDeadline(task.takenAtIso, taskHoldHours)} or this goes back to Up for grabs for someone else to take.
        </Text>
      ) : null}
      <PPTextBox value={result} onChange={setResult} lines={3} maxLength={1000} placeholder="What you found: numbers, a link, what a call said." />
      <View style={styles.row}>
        <PPButton label="Post result" primary disabled={busy || result.trim().length === 0} onPress={() => onAction(task.id, 'finish', result)} />
        <PPButton label="Let it go" disabled={busy} onPress={() => onAction(task.id, 'release')} />
      </View>
    </View>
  );
}

export function GoalCardControls(props: CardControlProps) {
  return props.isOwner ? <OwnerControls {...props} /> : <HelperControls {...props} />;
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  takeStack: { gap: 4 },
  takeNote: { fontSize: 11, fontFamily: interFamily('400') },
  note: { fontSize: 12, fontFamily: interFamily('400') },
});
