// The fields of the 3.1 "Log what happened" sheet on Android, the copy of the web's
// click-log-form.tsx: every field the 3.0 ClickLog form has.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  type SeThemeTokens,
} from '@ctf/shared';
import { ClickLogTags } from './ClickLogTags';
import type { ClickLogSheetStyles } from './clickLogSheetStyles';
import type { ClickLogEntry } from './useClickLogEntry';

type Part = { s: ClickLogSheetStyles; t: SeThemeTokens; entry: ClickLogEntry };

function Suggestion({ s, t, entry }: Part) {
  return (
    <View style={s.suggestion}>
      <View style={s.field}>
        <Text style={s.label}>{W.suggestionLabel}</Text>
        <TextInput accessibilityLabel={W.suggestionLabel} multiline style={s.textarea} maxLength={MAX_SCHEME_SUGGESTION_LENGTH} placeholder={W.suggestionPlaceholder} placeholderTextColor={t.soft} value={entry.fields.suggestion} onChangeText={entry.set.suggestion} />
      </View>
      <View style={s.field}>
        <Text style={s.label}>{W.quoraLabel}</Text>
        <TextInput accessibilityLabel={W.quoraLabel} keyboardType="url" autoCapitalize="none" autoCorrect={false} style={s.input} placeholder={W.quoraPlaceholder} placeholderTextColor={t.soft} value={entry.fields.quoraUrl} onChangeText={entry.set.quoraUrl} />
      </View>
      <Text style={s.note}>{W.suggestionNote}</Text>
    </View>
  );
}

function Tags({ s, t, entry }: Part) {
  const { problemTags, schemeTags } = entry.fields;
  return (
    <>
      <ClickLogTags s={s} t={t} label={W.problemsLabel} searchLabel={W.problemsSearch} values={problemTags} options={CLICK_LOG_PROBLEM_TAGS} reference={{ url: CLICK_LOG_PROBLEMS_PAGE_URL, title: W.problemsListTitle }} onChange={entry.set.problemTags} />
      <ClickLogTags s={s} t={t} label={W.schemesLabel} searchLabel={W.schemesSearch} values={schemeTags} options={clickLogSchemeOptions(entry.setup.canSuggestScheme)} reference={{ url: CLICK_LOG_SCHEMES_PAGE_URL, title: W.schemesListTitle }} onChange={entry.set.schemeTags} />
      {schemeTags.includes(NOT_LISTED_SCHEME_SLUG) ? <Suggestion s={s} t={t} entry={entry} /> : null}
      {clickLogTagged(problemTags, schemeTags) && !entry.geo.added ? <Text style={s.note}>{W.tagsNeedLocation}</Text> : null}
    </>
  );
}

function Share({ s, entry }: Omit<Part, 't'>) {
  const tagged = clickLogTagged(entry.fields.problemTags, entry.fields.schemeTags);
  const checked = tagged || entry.fields.share;
  const label = tagged ? SHARE_INCIDENT_LOCKED_LABEL : SHARE_INCIDENT_LABEL;
  return (
    <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled: tagged }} disabled={tagged} style={s.check} onPress={() => entry.set.share(!entry.fields.share)}>
      <View style={[s.box, checked ? s.boxOn : null, tagged ? s.dim : null]}>{checked ? <Text style={s.boxMark}>✓</Text> : null}</View>
      <Text style={s.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Location({ s, entry }: Omit<Part, 't'>) {
  const { geo } = entry;
  const locating = geo.status === 'locating';
  useEffect(() => {
    if (geo.added) AccessibilityInfo.announceForAccessibility(W.locationAddedSaid);
  }, [geo.added]);
  return (
    <>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: locating, selected: geo.added }} disabled={locating} style={[s.location, geo.added ? s.locationOn : null, locating ? s.dim : null]} onPress={geo.add}>
        <Text style={[s.locationLabel, geo.added ? s.locationLabelOn : null]}>{clickLogLocationLabel(geo.added, locating)}</Text>
      </TouchableOpacity>
      {geo.status === 'error' && geo.error ? (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {geo.error}
        </Text>
      ) : null}
    </>
  );
}

function Actions({ s, entry, onCancel }: Omit<Part, 't'> & { onCancel: () => void }) {
  const disabled = clickLogSubmitDisabled({
    submitting: entry.submitting,
    problemTags: entry.fields.problemTags,
    schemeTags: entry.fields.schemeTags,
    locationAdded: entry.geo.added,
    suggestion: entry.fields.suggestion,
  });
  return (
    <View style={s.actions}>
      <TouchableOpacity accessibilityRole="button" style={s.secondary} onPress={onCancel}>
        <Text style={s.secondaryLabel}>{W.cancel}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[s.primary, disabled ? s.dim : null]} onPress={() => void entry.submit()}>
        <Text style={s.primaryLabel}>{entry.submitting ? W.submitting : W.submit}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ClickLogForm({ s, t, entry, onCancel }: Part & { onCancel: () => void }) {
  return (
    <>
      <Text style={s.rule}>{W.rule}</Text>
      {entry.setup.problems.map((text) => (
        <Text key={text} accessibilityLiveRegion="polite" style={s.error}>
          {text}
        </Text>
      ))}
      <Location s={s} entry={entry} />
      <View style={s.field}>
        <Text style={s.label}>{W.noteLabel}</Text>
        <TextInput accessibilityLabel={W.noteLabel} multiline style={s.textarea} maxLength={MAX_NOTES_LENGTH} placeholder={W.notePlaceholder} placeholderTextColor={t.soft} value={entry.fields.note} onChangeText={entry.set.note} />
      </View>
      <Tags s={s} t={t} entry={entry} />
      <Share s={s} entry={entry} />
      {entry.error ? (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {entry.error}
        </Text>
      ) : null}
      <Actions s={s} entry={entry} onCancel={onCancel} />
    </>
  );
}
