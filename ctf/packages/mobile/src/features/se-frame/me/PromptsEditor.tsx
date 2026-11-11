// Me → the three profile lines on Android, the copy of the web's prompts-editor.tsx: each optional
// and short, saved on the account.

import React, { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_ME_PROMPT_KEYS, SE_ME_PROMPT_LABELS, SE_ME_PROMPT_MAX, SE_ME_WORDS as W, type SeMePrompts, type SeThemeTokens } from '@ctf/shared';
import { makeMeStyles } from './meStyles';
import { BackHeader } from './SettingsParts';

type Props = { t: SeThemeTokens; prompts: SeMePrompts; onSave: (_next: SeMePrompts) => Promise<string | null>; onDone: () => void };

export function PromptsEditor({ t, prompts, onSave, onDone }: Props) {
  const s = useMemo(() => makeMeStyles(t), [t]);
  const [draft, setDraft] = useState<SeMePrompts>(prompts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    const problem = await onSave(draft);
    setSaving(false);
    if (problem) return setError(problem);
    onDone();
  };
  return (
    <View style={s.stack}>
      <BackHeader s={s} t={t} title={W.promptsTitle} back={W.backToMe} onBack={onDone} />
      {SE_ME_PROMPT_KEYS.map((key) => (
        <View key={key} style={s.field}>
          <Text style={s.q}>{SE_ME_PROMPT_LABELS[key]}</Text>
          <TextInput
            accessibilityLabel={SE_ME_PROMPT_LABELS[key]}
            style={s.input}
            value={draft[key]}
            maxLength={SE_ME_PROMPT_MAX}
            onChangeText={(text) => setDraft({ ...draft, [key]: text })}
          />
        </View>
      ))}
      <View style={s.row}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => void save()} style={[s.pill, s.primary, saving ? s.disabled : null]}>
          <Text style={[s.pillLabel, s.primaryLabel]}>{saving ? W.promptsSaving : W.promptsSave}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onDone} style={s.pill}>
          <Text style={s.pillLabel}>{W.promptsCancel}</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.alert}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
