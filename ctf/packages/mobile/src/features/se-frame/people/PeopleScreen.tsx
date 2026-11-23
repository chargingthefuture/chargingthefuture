// People on Android, the copy of the web (web components/se-frame/people/), built to the approved
// boards "People, verified" and "People, not yet verified": the Directory with who offers what now,
// paged, or for a member not approved yet the number listed and the way to Unlock.

import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_PEOPLE_PAGE_SIZE, sePeopleChips, SE_PEOPLE_WORDS as W, type SePeopleFilter, type SePeoplePage, type SeThemeTokens } from '@ctf/shared';
import type { FeatureKey } from '../../../navigation/screens';
import { useScrollFrameToTop } from '../frame-scroll';
import { PeopleLocked } from './PeopleLocked';
import { PersonCard, type OpenSheet } from './PersonCard';
import { PersonSheets, usePersonSheet } from './PersonSheets';
import { makePeopleStyles, type PeopleStyles } from './peopleStyles';
import { usePeople, usePeopleCount, type PeopleState } from './usePeople';

function Button({ s, label, onPress, disabled }: { s: PeopleStyles; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled ? s.disabled : null]}>
      <Text style={s.buttonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pager({ s, people, onPage }: { s: PeopleStyles; people: SePeoplePage; onPage: (_page: number) => void }) {
  const from = people.total === 0 ? 0 : (people.page - 1) * SE_PEOPLE_PAGE_SIZE + 1;
  const to = Math.min(people.page * SE_PEOPLE_PAGE_SIZE, people.total);
  const last = Math.max(1, Math.ceil(people.total / SE_PEOPLE_PAGE_SIZE));
  return (
    <View style={s.pager}>
      <Button s={s} label={W.previous} disabled={people.page <= 1} onPress={() => onPage(people.page - 1)} />
      <Text style={s.meta}>{W.range(from, to, people.total)}</Text>
      <Button s={s} label={W.next} disabled={people.page >= last} onPress={() => onPage(people.page + 1)} />
    </View>
  );
}

type ResultsProps = { s: PeopleStyles; state: PeopleState; onSheet: OpenSheet; onPage: (_page: number) => void; onRetry: () => void };

function Results({ s, state, onSheet, onPage, onRetry }: ResultsProps) {
  if (state.kind === 'loading' || state.kind === 'locked') return <Text style={s.meta}>{W.loading}</Text>;
  if (state.kind === 'error') {
    return (
      <Text accessibilityRole="alert" style={s.meta}>
        {W.failed} {state.message}{' '}
        <Text accessibilityRole="button" onPress={onRetry} style={s.link}>
          {W.tryAgain}
        </Text>
      </Text>
    );
  }
  if (state.people.items.length === 0) return <Text style={s.meta}>{W.empty}</Text>;
  return (
    <>
      {state.people.items.map((person) => (
        <PersonCard key={person.id} s={s} person={person} onSheet={onSheet} />
      ))}
      <Pager s={s} people={state.people} onPage={onPage} />
    </>
  );
}

function Header({ s, count }: { s: PeopleStyles; count: number | null }) {
  return (
    <View style={s.header}>
      <Text accessibilityRole="header" style={s.title}>
        {W.title}
      </Text>
      {count !== null ? <Text style={s.count}>{W.listedCount(count)}</Text> : null}
    </View>
  );
}

function Filters({ s, filter, onFilter }: { s: PeopleStyles; filter: SePeopleFilter; onFilter: (_next: SePeopleFilter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={s.chips} accessibilityRole="radiogroup" accessibilityLabel={W.filters}>
      {sePeopleChips(filter).map((chip) => {
        const on = filter === chip.id;
        return (
          <TouchableOpacity key={chip.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onFilter(chip.id)} style={[s.chip, on ? s.chipOn : null]}>
            <Text style={[s.chipLabel, on ? s.chipLabelOn : null]}>{chip.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// `initialFilter` is 'fits' when Today's Match card opened People through See who fits.
type ScreenProps = { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void; onToday: () => void; initialFilter?: SePeopleFilter; viewerId: string | null };

export function PeopleScreen({ t, onOpen, onToday, initialFilter = 'all', viewerId }: ScreenProps) {
  const s = useMemo(() => makePeopleStyles(t), [t]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<SePeopleFilter>(initialFilter);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const state = usePeople(page, filter, query, attempt);
  const count = usePeopleCount();
  const scrollToTop = useScrollFrameToTop();
  // A new page starts at its top, as the web does.
  const turnPage = (next: number) => {
    setPage(next);
    scrollToTop();
  };
  const sheets = usePersonSheet();

  if (state.kind === 'locked') {
    return (
      <View style={s.lockedScreen}>
        <Header s={s} count={null} />
        <PeopleLocked s={s} count={count} onUnlock={() => onOpen('unlock')} onToday={onToday} />
      </View>
    );
  }
  return (
    <View style={s.screen}>
      <Header s={s} count={count} />
      <TextInput
        accessibilityLabel={W.searchLabel}
        placeholder={W.search}
        placeholderTextColor={t.soft}
        style={s.search}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setPage(1);
        }}
      />
      <Filters
        s={s}
        filter={filter}
        onFilter={(next) => {
          setFilter(next);
          setPage(1);
        }}
      />
      <Results s={s} state={state} onSheet={sheets.open} onPage={turnPage} onRetry={() => setAttempt((n) => n + 1)} />
      <PersonSheets t={t} sheet={sheets.sheet} viewerId={viewerId} onClose={sheets.close} onSwitch={sheets.switchTo} />
    </View>
  );
}
