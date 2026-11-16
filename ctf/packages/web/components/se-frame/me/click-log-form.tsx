'use client';

import {
  SE_CLICK_LOG_WORDS as W,
  CLICK_LOG_PROBLEM_TAGS,
  CLICK_LOG_PROBLEMS_PAGE_URL,
  CLICK_LOG_SCHEMES_PAGE_URL,
  MAX_NOTES_LENGTH,
  MAX_SCHEME_SUGGESTION_LENGTH,
  NOT_LISTED_SCHEME_SLUG,
  SHARE_INCIDENT_LABEL,
  SHARE_INCIDENT_LOCKED_LABEL,
  clickLogLocationLabel,
  clickLogSchemeOptions,
  clickLogSubmitDisabled,
  clickLogTagged,
} from '@ctf/shared';
import { ClickLogTags } from './click-log-tags';
import type { ClickLogEntry } from './use-click-log-entry';
import styles from './click-log-sheet.module.css';

// The fields of the 3.1 "Log what happened" sheet, every one the 3.0 ClickLog form has.

function Suggestion({ entry }: { entry: ClickLogEntry }) {
  return (
    <div className={styles.suggestion}>
      <label className={styles.field}>
        <span className={styles.label}>{W.suggestionLabel}</span>
        <textarea className={styles.textarea} rows={2} maxLength={MAX_SCHEME_SUGGESTION_LENGTH} placeholder={W.suggestionPlaceholder} value={entry.fields.suggestion} onChange={(e) => entry.set.suggestion(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{W.quoraLabel}</span>
        <input type="url" className={styles.input} placeholder={W.quoraPlaceholder} value={entry.fields.quoraUrl} onChange={(e) => entry.set.quoraUrl(e.target.value)} />
      </label>
      <p className={styles.note}>{W.suggestionNote}</p>
    </div>
  );
}

function Tags({ entry }: { entry: ClickLogEntry }) {
  const { problemTags, schemeTags } = entry.fields;
  return (
    <>
      <ClickLogTags label={W.problemsLabel} searchLabel={W.problemsSearch} values={problemTags} options={CLICK_LOG_PROBLEM_TAGS} reference={{ url: CLICK_LOG_PROBLEMS_PAGE_URL, title: W.problemsListTitle }} onChange={entry.set.problemTags} />
      <ClickLogTags label={W.schemesLabel} searchLabel={W.schemesSearch} values={schemeTags} options={clickLogSchemeOptions(entry.setup.canSuggestScheme)} reference={{ url: CLICK_LOG_SCHEMES_PAGE_URL, title: W.schemesListTitle }} onChange={entry.set.schemeTags} />
      {schemeTags.includes(NOT_LISTED_SCHEME_SLUG) ? <Suggestion entry={entry} /> : null}
      {clickLogTagged(problemTags, schemeTags) && !entry.geo.added ? <p className={styles.note}>{W.tagsNeedLocation}</p> : null}
    </>
  );
}

function Share({ entry }: { entry: ClickLogEntry }) {
  const tagged = clickLogTagged(entry.fields.problemTags, entry.fields.schemeTags);
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={tagged || entry.fields.share} disabled={tagged} onChange={(e) => entry.set.share(e.target.checked)} />
      <span>{tagged ? SHARE_INCIDENT_LOCKED_LABEL : SHARE_INCIDENT_LABEL}</span>
    </label>
  );
}

function Location({ entry }: { entry: ClickLogEntry }) {
  const { geo } = entry;
  const locating = geo.status === 'locating';
  return (
    <>
      <button type="button" className={geo.added ? styles.locationOn : styles.location} disabled={locating} aria-pressed={geo.added} onClick={geo.add}>
        {clickLogLocationLabel(geo.added, locating)}
      </button>
      {geo.status === 'error' && geo.error ? (
        <p role="alert" className={styles.error}>
          {geo.error}
        </p>
      ) : null}
    </>
  );
}

export function ClickLogForm({ entry, onCancel }: { entry: ClickLogEntry; onCancel: () => void }) {
  const disabled = clickLogSubmitDisabled({
    submitting: entry.submitting,
    problemTags: entry.fields.problemTags,
    schemeTags: entry.fields.schemeTags,
    locationAdded: entry.geo.added,
    suggestion: entry.fields.suggestion,
  });
  return (
    <div className={styles.form}>
      <p className={styles.rule}>{W.rule}</p>
      {entry.setup.problems.map((text) => (
        <p key={text} role="alert" className={styles.error}>
          {text}
        </p>
      ))}
      <label className={styles.field}>
        <span className={styles.label}>{W.noteLabel}</span>
        <textarea className={styles.textarea} rows={3} maxLength={MAX_NOTES_LENGTH} placeholder={W.notePlaceholder} value={entry.fields.note} onChange={(e) => entry.set.note(e.target.value)} />
      </label>
      <Tags entry={entry} />
      <Share entry={entry} />
      <Location entry={entry} />
      {entry.error ? (
        <p role="alert" className={styles.error}>
          {entry.error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {W.cancel}
        </button>
        <button type="button" className={styles.primary} disabled={disabled} onClick={() => void entry.submit()}>
          {entry.submitting ? W.submitting : W.submit}
        </button>
      </div>
    </div>
  );
}
