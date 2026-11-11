// One person on Android, the copy of the web (components/se-frame/people/person-card.tsx), built to
// the approved board "People, verified". The card itself opens the Directory profile; Request a quote
// shows only for someone offering a skill. Both open their pages in the browser panel.

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_PEOPLE_WORDS as W, sePersonLine, sePersonLinks, sePersonListedOnly, type SePerson } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import type { PeopleStyles } from './peopleStyles';

type Go = (_href: string) => void;

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

export function PersonCard({ s, person, go }: { s: PeopleStyles; person: SePerson; go: Go }) {
  const links = sePersonLinks(person);
  const listed = sePersonListedOnly(person);
  const line = sePersonLine(person);
  return (
    <TouchableOpacity accessibilityRole="link" accessibilityLabel={person.name} activeOpacity={0.8} onPress={() => go(links.profile)} style={s.card}>
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
        {links.quote ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => go(links.quote ?? '')} style={s.quote}>
            <Text style={s.quoteLabel}>{W.quote}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
