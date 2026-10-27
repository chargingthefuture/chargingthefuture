// People on Android, the copy of the web (web components/se-frame/people/): the Directory, with who
// offers what now. Foundation offerings filled, Directory listings outlined, Request a quote only
// when someone offers a skill. Profile and Request a quote open their pages in the browser.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SE_PEOPLE_PAGE_SIZE, SE_PEOPLE_WORDS as W, sePersonLinks, type SePeoplePage, type SePerson, type SeThemeTokens } from '@ctf/shared';
import { authedFetchJson } from '../../../auth/authedFetch';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; people: SePeoplePage };
type Styles = ReturnType<typeof makeStyles>;
type Go = (_href: string) => void;

function usePeople(page: number, offeringOnly: boolean, query: string, attempt: number): State {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page) });
    if (offeringOnly) params.set('offering', '1');
    if (query.trim()) params.set('q', query.trim());
    const timer = setTimeout(() => {
      authedFetchJson<{ people: SePeoplePage }>(`/api/people?${params.toString()}`)
        .then((body) => {
          if (active) setState({ kind: 'ready', people: body.people });
        })
        .catch((error: unknown) => {
          if (active) setState({ kind: 'error', message: error instanceof Error ? error.message : 'The request did not complete.' });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, offeringOnly, query, attempt]);
  return state;
}

function Button({ s, label, onPress, primary, disabled }: { s: Styles; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: primary }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, primary ? s.primary : null, disabled ? s.disabled : null]}
    >
      <Text style={[s.buttonLabel, primary ? s.primaryLabel : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PersonCard({ s, person, go }: { s: Styles; person: SePerson; go: Go }) {
  const links = sePersonLinks(person);
  const listed = person.listed.filter((skill) => !person.offering.includes(skill));
  return (
    <View style={s.card} accessibilityLabel={person.name}>
      <View style={s.head}>
        <SeAvatar accountId={person.id} size={44} />
        <View style={s.who}>
          <Text style={s.name}>{person.name}</Text>
          {person.jobTitle || person.headline ? <Text style={s.meta}>{person.jobTitle ?? person.headline}</Text> : null}
        </View>
      </View>
      {person.offering.length > 0 ? (
        <View style={s.skills} accessibilityLabel={W.offering}>
          {person.offering.map((skill) => (
            <Text key={skill} style={[s.skill, s.offering]}>
              {skill}
            </Text>
          ))}
        </View>
      ) : null}
      {listed.length > 0 ? (
        <View style={s.skills} accessibilityLabel={W.listed}>
          {listed.map((skill) => (
            <Text key={skill} style={[s.skill, s.listed]}>
              {skill}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={s.skills}>
        <Button s={s} label={W.profile} onPress={() => go(links.profile)} />
        {links.quote ? <Button s={s} label={W.quote} primary onPress={() => go(links.quote ?? '')} /> : null}
      </View>
    </View>
  );
}

function Results({ s, state, go, onPage, onRetry }: { s: Styles; state: State; go: Go; onPage: (_page: number) => void; onRetry: () => void }) {
  if (state.kind === 'loading') return <Text style={s.meta}>{W.loading}</Text>;
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
  const { people } = state;
  if (people.items.length === 0) return <Text style={s.meta}>{W.empty}</Text>;
  const from = (people.page - 1) * SE_PEOPLE_PAGE_SIZE + 1;
  const to = Math.min(people.page * SE_PEOPLE_PAGE_SIZE, people.total);
  const last = Math.max(1, Math.ceil(people.total / SE_PEOPLE_PAGE_SIZE));
  return (
    <>
      {people.items.map((person) => (
        <PersonCard key={person.id} s={s} person={person} go={go} />
      ))}
      <View style={s.pager}>
        <Button s={s} label={W.previous} disabled={people.page <= 1} onPress={() => onPage(people.page - 1)} />
        <Text style={s.meta}>{W.range(from, to, people.total)}</Text>
        <Button s={s} label={W.next} disabled={people.page >= last} onPress={() => onPage(people.page + 1)} />
      </View>
    </>
  );
}

export function PeopleScreen({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const [page, setPage] = useState(1);
  const [offeringOnly, setOfferingOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const state = usePeople(page, offeringOnly, query, attempt);
  const go: Go = (href) => openTodayLink(href, onOpen);
  return (
    <>
      <TextInput
        accessibilityLabel={W.search}
        placeholder={W.search}
        placeholderTextColor={t.soft}
        style={s.search}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setPage(1);
        }}
      />
      <View style={s.skills} accessibilityRole="radiogroup">
        <Button s={s} label={W.everyone} primary={!offeringOnly} onPress={() => (setOfferingOnly(false), setPage(1))} />
        <Button s={s} label={W.offeringNow} primary={offeringOnly} onPress={() => (setOfferingOnly(true), setPage(1))} />
      </View>
      <Results s={s} state={state} go={go} onPage={setPage} onRetry={() => setAttempt((n) => n + 1)} />
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    search: { minHeight: 46, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16, fontFamily: SE_FONT.sans },
    skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    primary: { backgroundColor: t.btn },
    disabled: { opacity: 0.5 },
    buttonLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    primaryLabel: { color: t.onBtn },
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    who: { flexShrink: 1, gap: 2 },
    name: { fontSize: 17, color: t.ink, fontFamily: SE_FONT.sansBold },
    meta: { fontSize: 14, color: t.soft, fontFamily: SE_FONT.sans },
    skill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden', borderWidth: 1.5, borderColor: t.kind.offer, fontSize: 13 },
    offering: { backgroundColor: t.kind.offer, color: t.bg, fontFamily: SE_FONT.sansBold },
    listed: { color: t.ink, fontFamily: SE_FONT.sans },
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    link: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
  });
}
