// One tag list in the 3.1 "Log what happened" sheet on Android, the copy of the web's
// click-log-tags.tsx: the question with its "Full list" link, the picked tags with a remove button
// each, a search box and the tags that match it, up to MAX_TAGS_PER_KIND picked.

import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  SE_CLICK_LOG_WORDS as W,
  MAX_TAGS_PER_KIND,
  clickLogMatchTags,
  clickLogPickedTags,
  clickLogToggleTag,
  type ClickLogTag,
  type SeThemeTokens,
} from '@ctf/shared';
import { ShareLink } from '../../../components/shared/ShareLink';
import type { ClickLogSheetStyles } from './clickLogSheetStyles';

type Props = {
  s: ClickLogSheetStyles;
  t: SeThemeTokens;
  label: string;
  searchLabel: string;
  values: string[];
  options: readonly ClickLogTag[];
  reference: { url: string; title: string };
  onChange: (_values: string[]) => void;
};

function Picked({ s, picked, onRemove }: { s: ClickLogSheetStyles; picked: ClickLogTag[]; onRemove: (_slug: string) => void }) {
  if (picked.length === 0) return null;
  return (
    <View style={s.picked}>
      {picked.map((tag) => (
        <View key={tag.slug} style={s.pickedTag}>
          <Text style={s.pickedLabel}>{tag.label}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.remove(tag.label)} style={s.remove} onPress={() => onRemove(tag.slug)}>
            <Text style={s.removeLabel}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function Chips({ s, matches, values, search, onToggle }: { s: ClickLogSheetStyles; matches: readonly ClickLogTag[]; values: string[]; search: string; onToggle: (_slug: string) => void }) {
  return (
    <ScrollView style={s.chips} contentContainerStyle={s.chipsContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      {matches.length === 0 ? (
        <Text style={s.note}>{W.noMatch(search.trim())}</Text>
      ) : (
        matches.map((tag) => {
          const on = values.includes(tag.slug);
          return (
            <TouchableOpacity key={tag.slug} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on ? s.chipOn : null]} onPress={() => onToggle(tag.slug)}>
              <Text style={[s.chipLabel, on ? s.chipLabelOn : null]}>
                {on ? '✓ ' : ''}
                {tag.label}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

export function ClickLogTags({ s, t, label, searchLabel, values, options, reference, onChange }: Props) {
  const [search, setSearch] = useState('');
  const toggle = (slug: string) => {
    onChange(clickLogToggleTag(values, slug));
    setSearch('');
  };
  return (
    <View style={s.group}>
      <View style={s.groupHead}>
        <Text accessibilityRole="header" style={s.groupLabel}>
          {label}
        </Text>
        <ShareLink url={reference.url} label={W.fullList} title={reference.title} color={t.kind.story} />
      </View>
      <Picked s={s} picked={clickLogPickedTags(options, values)} onRemove={(slug) => onChange(values.filter((value) => value !== slug))} />
      {values.length >= MAX_TAGS_PER_KIND ? <Text style={s.note}>{W.atCap(MAX_TAGS_PER_KIND)}</Text> : null}
      <View style={s.searchRow}>
        <TextInput accessibilityLabel={searchLabel} placeholder={searchLabel} placeholderTextColor={t.soft} style={[s.input, s.searchInput]} value={search} autoCorrect={false} onChangeText={setSearch} />
        {search ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.clearSearch} style={s.clear} onPress={() => setSearch('')}>
            <Text style={s.clearLabel}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Chips s={s} matches={clickLogMatchTags(options, search)} values={values} search={search} onToggle={toggle} />
    </View>
  );
}
