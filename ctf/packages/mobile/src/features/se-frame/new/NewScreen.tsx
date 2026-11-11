// + New on Android, the copy of the web (web components/se-frame/new/new-screen.tsx), to the approved
// boards "New post", "Schedule a talk" and "Schedule a talk, not yet verified": a sheet with Close,
// an Ask / Offer / Story / Talk switch, and the chosen kind under it. Ask is posted here; Talk books
// a TI Radio slot; an Offer or a Story opens where it is made (in the app for Foundation, in a browser
// panel for the rest). Ask the architect opens from the line under the switch.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  SE_ARCHITECT_WORDS,
  SE_NEW_KINDS,
  SE_NEW_SHEET_WORDS as W,
  SE_OFFER_CHOICES,
  SE_OFFER_WORDS,
  SE_ROOM_RULE,
  SE_STORY_WORDS,
  SE_TALK_WORDS,
  type SeNewKind,
  type SeThemeTokens,
} from '@ctf/shared';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';
import { AskForm } from './AskForm';
import { ArchitectSection } from './ArchitectSection';
import { TalkForm } from './TalkForm';
import { makeSheetStyles, type SheetStyles } from './sheetStyles';

type Styles = ReturnType<typeof makeStyles>;
type BodyProps = { t: SeThemeTokens; s: Styles; sh: SheetStyles; go: (_href: string) => void; onOpen: (_key: FeatureKey) => void };

// Close on the left; on the right, the community guidelines, or the room rule while booking a talk.
function SheetTop({ t, sh, talk, onClose, go }: { t: SeThemeTokens; sh: SheetStyles; talk: boolean; onClose: () => void; go: (_href: string) => void }) {
  const [rule, setRule] = useState(false);
  return (
    <>
      <View style={sh.top}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} onPress={onClose} style={sh.close}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </TouchableOpacity>
        {talk ? (
          <Text accessibilityRole="button" accessibilityState={{ expanded: rule }} onPress={() => setRule((value) => !value)} style={sh.topLink}>
            {SE_TALK_WORDS.roomRule}
          </Text>
        ) : (
          <Text accessibilityRole="link" onPress={() => go(W.guidelinesHref)} style={sh.topLink}>
            {W.guidelines}
          </Text>
        )}
      </View>
      {talk && rule ? <Text style={sh.rule}>{SE_ROOM_RULE}</Text> : null}
    </>
  );
}

function KindSwitch({ sh, kind, onKind }: { sh: SheetStyles; kind: SeNewKind; onKind: (_kind: SeNewKind) => void }) {
  return (
    <View accessibilityLabel={W.kinds} style={sh.kinds}>
      {SE_NEW_KINDS.map((item) => {
        const on = kind === item.key;
        return (
          <TouchableOpacity key={item.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onKind(item.key)} style={[sh.kind, on ? sh.kindOn : null]}>
            <Text style={[sh.kindLabel, on ? sh.kindLabelOn : null]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Choice({ s, title, text, onPress }: { s: Styles; title: string; text?: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="link" onPress={onPress} style={s.choice}>
      <Text style={s.choiceTitle}>{title}</Text>
      {text ? <Text style={s.text}>{text}</Text> : null}
    </TouchableOpacity>
  );
}

function OfferBody({ s, go }: BodyProps) {
  return (
    <View style={s.body}>
      <Text style={s.text}>{SE_OFFER_WORDS.intro}</Text>
      {SE_OFFER_CHOICES.map((choice) => (
        <Choice key={choice.key} s={s} title={choice.label} text={choice.text} onPress={() => go(choice.href)} />
      ))}
    </View>
  );
}

function StoryBody({ s, go }: BodyProps) {
  return (
    <View style={s.body}>
      <Text style={s.text}>{SE_STORY_WORDS.intro}</Text>
      <Choice s={s} title={SE_STORY_WORDS.open} onPress={() => go(SE_STORY_WORDS.href)} />
    </View>
  );
}

function ArchitectBody({ t, sh, onOpen }: BodyProps) {
  return (
    <>
      <View style={sh.headLeft}>
        <Text accessibilityRole="header" style={sh.titleSmall}>
          {SE_ARCHITECT_WORDS.title}
        </Text>
        <Text style={sh.sub}>{SE_ARCHITECT_WORDS.intro}</Text>
      </View>
      <ArchitectSection t={t} onOpen={onOpen} />
    </>
  );
}

const BODIES: Record<SeNewKind, (_props: BodyProps) => React.ReactElement> = {
  ask: ({ t }) => <AskForm t={t} />,
  offer: OfferBody,
  story: StoryBody,
  talk: ({ t, onOpen }) => <TalkForm t={t} onOpen={onOpen} />,
  architect: ArchitectBody,
};

// `initialKind` opens a sheet other than Ask: Settings → Ask the architect opens the architect's.
export function NewScreen({
  t,
  onOpen,
  onClose,
  initialKind = 'ask',
}: {
  t: SeThemeTokens;
  onOpen: (_key: FeatureKey) => void;
  onClose: () => void;
  initialKind?: SeNewKind;
}) {
  const s = useMemo(() => makeStyles(t), [t]);
  const sh = useMemo(() => makeSheetStyles(t), [t]);
  const [kind, setKind] = useState<SeNewKind>(initialKind);
  const go = (href: string) => openTodayLink(href, onOpen);
  const Body = BODIES[kind];
  // Ask, Offer and Story share "Post something" above the switch; Talk and the architect carry
  // their own heading under it.
  const posting = kind === 'ask' || kind === 'offer' || kind === 'story';
  return (
    <View accessibilityLabel={W.label} style={sh.sheet}>
      <SheetTop t={t} sh={sh} talk={kind === 'talk'} onClose={onClose} go={go} />
      {posting ? (
        <View style={sh.head}>
          <Text accessibilityRole="header" style={sh.title}>
            {W.heading}
          </Text>
          <Text style={[sh.sub, sh.headSub]}>{W.intro}</Text>
        </View>
      ) : null}
      <KindSwitch sh={sh} kind={kind} onKind={setKind} />
      {kind === 'architect' ? null : (
        <Text accessibilityRole="button" onPress={() => setKind('architect')} style={sh.architect}>
          {W.architect}
        </Text>
      )}
      <Body t={t} s={s} sh={sh} go={go} onOpen={onOpen} />
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    body: { gap: 10 },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    choice: { gap: 4, minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg },
    choiceTitle: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
