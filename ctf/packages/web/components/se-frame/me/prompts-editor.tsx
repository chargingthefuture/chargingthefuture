'use client';

import { useState } from 'react';
import { SE_ME_PROMPT_KEYS, SE_ME_PROMPT_LABELS, SE_ME_PROMPT_MAX, SE_ME_WORDS as W, type SeMePrompts } from '@ctf/shared';
import { BackHeader } from './back-header';
import styles from './me.module.css';

// Me → the three profile lines, each optional and short. Saved on the account.
export function PromptsEditor({
  prompts,
  onSave,
  onDone,
}: {
  prompts: SeMePrompts;
  onSave: (_next: SeMePrompts) => Promise<string | null>;
  onDone: () => void;
}) {
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
    <div className={styles.stack}>
      <BackHeader title={W.promptsTitle} back={W.backToMe} onBack={onDone} />
      {SE_ME_PROMPT_KEYS.map((key) => (
        <label key={key} className={styles.field}>
          <span className={styles.q}>{SE_ME_PROMPT_LABELS[key]}</span>
          <input
            className={styles.input}
            value={draft[key]}
            maxLength={SE_ME_PROMPT_MAX}
            onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
          />
        </label>
      ))}
      <div className={styles.row}>
        <button type="button" className={`${styles.pillButton} ${styles.primary}`} disabled={saving} onClick={() => void save()}>
          {saving ? W.promptsSaving : W.promptsSave}
        </button>
        <button type="button" className={styles.pillButton} onClick={onDone}>
          {W.promptsCancel}
        </button>
      </div>
      {error ? (
        <p role="alert" className={styles.status}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
