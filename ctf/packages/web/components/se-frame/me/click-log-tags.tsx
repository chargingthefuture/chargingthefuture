'use client';

import { useId, useState } from 'react';
import {
  SE_CLICK_LOG_WORDS as W,
  MAX_TAGS_PER_KIND,
  clickLogMatchTags,
  clickLogPickedTags,
  clickLogToggleTag,
  type ClickLogTag,
} from '@ctf/shared';
import { ShareLink } from '../../shared/share-link';
import styles from './click-log-sheet.module.css';

// One tag list in the 3.1 "Log what happened" sheet, the same picker as the 3.0 ClickLog form: the
// question with its "Full list" link, the picked tags with a remove button each, a search box and
// the tags that match it, up to MAX_TAGS_PER_KIND picked.

type Props = {
  label: string;
  searchLabel: string;
  values: string[];
  options: readonly ClickLogTag[];
  reference: { url: string; title: string };
  onChange: (_values: string[]) => void;
};

function Picked({ picked, onRemove }: { picked: ClickLogTag[]; onRemove: (_slug: string) => void }) {
  if (picked.length === 0) return null;
  return (
    <ul className={styles.picked}>
      {picked.map((tag) => (
        <li key={tag.slug} className={styles.pickedTag}>
          {tag.label}
          <button type="button" className={styles.remove} aria-label={W.remove(tag.label)} onClick={() => onRemove(tag.slug)}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ClickLogTags({ label, searchLabel, values, options, reference, onChange }: Props) {
  const id = useId();
  const [search, setSearch] = useState('');
  const matches = clickLogMatchTags(options, search);
  const atCap = values.length >= MAX_TAGS_PER_KIND;
  const toggle = (slug: string) => {
    onChange(clickLogToggleTag(values, slug));
    setSearch('');
  };
  return (
    <fieldset className={styles.group}>
      <div className={styles.groupHead}>
        <legend className={styles.label}>{label}</legend>
        <ShareLink url={reference.url} label={W.fullList} title={reference.title} iconSize={12} triggerStyle={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--se-kind-story)', whiteSpace: 'nowrap' }} />
      </div>
      <Picked picked={clickLogPickedTags(options, values)} onRemove={(slug) => onChange(values.filter((value) => value !== slug))} />
      {atCap ? <p className={styles.note}>{W.atCap(MAX_TAGS_PER_KIND)}</p> : null}
      <div className={styles.searchRow}>
        <input id={`${id}-search`} type="search" className={styles.input} aria-label={searchLabel} placeholder={searchLabel} value={search} onChange={(e) => setSearch(e.target.value)} />
        {search ? (
          <button type="button" className={styles.clear} aria-label={W.clearSearch} onClick={() => setSearch('')}>
            ×
          </button>
        ) : null}
      </div>
      <div className={styles.chips}>
        {matches.length === 0 ? (
          <p className={styles.note}>{W.noMatch(search.trim())}</p>
        ) : (
          matches.map((tag) => {
            const on = values.includes(tag.slug);
            return (
              <button key={tag.slug} type="button" aria-pressed={on} className={on ? styles.chipOn : styles.chip} onClick={() => toggle(tag.slug)}>
                {on ? '✓ ' : ''}
                {tag.label}
              </button>
            );
          })
        )}
      </div>
    </fieldset>
  );
}
