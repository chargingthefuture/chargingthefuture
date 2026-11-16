// One person on Android, the copy of the web (components/se-frame/people/person-card.tsx), built to
// the approved board "People, verified". Under the skills, as the Directory has them: Profile (the
// profile in a sheet), the Quora profile when there is one (the shared link control: see the
// address, open it, or copy or share it) and Request a quote for somebody offering a skill (the
// Foundation request, in a sheet). Nothing here opens a 3.0 page.

import React, { useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_PEOPLE_WORDS as W, SE_PERSON_SHEET_WORDS as S, sePersonLine, sePersonLinks, sePersonListedOnly, type SePerson } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { ShareLink } from '../../../components/shared/ShareLink';
import type { PeopleStyles } from './peopleStyles';

export type PersonSheet = { kind: 'profile' | 'quote'; person: SePerson };
// The sheet to open, with the button that opened it, so focus can go back to it on close.
export type OpenSheet = (_sheet: PersonSheet, _opener: View | null) => void;

function Skills({ s, label, skills, offering }: { s: PeopleStyles; label: string; skills: string[]; offering?: boolean }) {
  return (
    <View style={s.skills}>
      <Text style={[s.skillsLabel, offering ? s.offeringLabel : null]}>{label}</Text>
      {skills.map((skill) => (
        <Text key={skill} style={[s.skill, offering ? s.offering : s.listed]}>
          {skill}
        </Text>
      ))}
    </View>
  );
}

function Actions({ s, person, onSheet }: { s: PeopleStyles; person: SePerson; onSheet: OpenSheet }) {
  const links = sePersonLinks(person);
  const quoteRef = useRef<View>(null);
  const profileRef = useRef<View>(null);
  return (
    <View style={s.actions}>
      {links.canQuote ? (
        <TouchableOpacity ref={quoteRef} accessibilityRole="button" accessibilityLabel={S.openQuote(person.name)} onPress={() => onSheet({ kind: 'quote', person }, quoteRef.current)} style={s.quote}>
          <Text style={s.quoteLabel}>{W.quote}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity ref={profileRef} accessibilityRole="button" accessibilityLabel={S.openProfile(person.name)} onPress={() => onSheet({ kind: 'profile', person }, profileRef.current)} style={s.quote}>
        <Text style={s.quoteLabel}>{W.profile}</Text>
      </TouchableOpacity>
      {links.quora ? (
        <ShareLink url={links.quora} label={W.quora} title={S.quoraTitle} accessibilityLabel={S.quoraFor(person.name)} triggerStyle={s.quote} labelStyle={s.quoteLabel} />
      ) : null}
    </View>
  );
}

export function PersonCard({ s, person, onSheet }: { s: PeopleStyles; person: SePerson; onSheet: OpenSheet }) {
  const listed = sePersonListedOnly(person);
  const line = sePersonLine(person);
  return (
    <View accessibilityLabel={person.name} style={s.card}>
      <View style={s.face}>
        <SeAvatar accountId={person.id} size={48} />
      </View>
      <View style={s.body}>
        <View style={s.nameRow}>
          <Text style={s.name}>{person.name}</Text>
          <Text style={s.tag}>{person.claimed ? W.member : W.listedTag}</Text>
        </View>
        {line ? <Text style={s.line}>{line}</Text> : null}
        {person.offering.length > 0 ? <Skills s={s} label={W.offering} skills={person.offering} offering /> : null}
        {listed.length > 0 ? <Skills s={s} label={W.listed} skills={listed} /> : null}
        <Actions s={s} person={person} onSheet={onSheet} />
      </View>
    </View>
  );
}
