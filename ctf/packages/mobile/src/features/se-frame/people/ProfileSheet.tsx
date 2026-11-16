// A person's profile on Android, the copy of the web's profile-sheet.tsx: what the Directory's profile
// page shows and the actions it offers, read from the Directory's own route.

import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_PERSON_SHEET_WORDS as W, sePersonSheetPath, type SePersonProfile, type SeThemeTokens } from '@ctf/shared';
import { getApiBaseUrl } from '../../../auth/authedFetch';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { ShareLink } from '../../../components/shared/ShareLink';
import { BlockMemberButton } from '../../blocks/BlockMemberButton';
import { PersonSheetFrame, SheetStatus } from './PersonSheetFrame';
import { makePersonSheetStyles, type PersonSheetStyles } from './personSheetStyles';
import { usePersonProfile } from './usePersonSheets';

type Props = { t: SeThemeTokens; profileId: string; name: string; viewerId: string | null; canQuote: boolean; onQuote: () => void; onClose: () => void };

function Identity({ s, p }: { s: PersonSheetStyles; p: SePersonProfile }) {
  const line = [p.jobTitle, p.sector, p.place].filter(Boolean).join(' · ');
  return (
    <View style={s.identity}>
      <View style={s.face}>
        <SeAvatar accountId={p.id} size={64} />
      </View>
      <View style={s.who}>
        <View style={s.nameRow}>
          <Text accessibilityRole="header" style={s.name}>
            {p.name}
          </Text>
          <Text style={s.tag}>{p.claimedByUserId ? W.member : W.listed}</Text>
          {p.weavers ? <Text style={s.tag}>{W.weavers}</Text> : null}
        </View>
        {p.username ? <Text style={s.soft}>@{p.username}</Text> : null}
        {p.headline ? <Text style={s.headline}>{p.headline}</Text> : null}
        {p.communityGenerated && !p.claimedByUserId ? <Text style={s.origin}>{W.communityGenerated}</Text> : null}
        {p.communityGenerated && p.nominatedBy ? <Text style={s.soft}>{W.nominatedBy(p.nominatedBy)}</Text> : null}
        {line ? <Text style={s.soft}>{line}</Text> : null}
      </View>
    </View>
  );
}

function shareAddress(id: string): string | null {
  try {
    return `${getApiBaseUrl()}${sePersonSheetPath(id)}`;
  } catch {
    // no-trace: a build with no app address offers no Share; the rest of the profile still shows
    return null;
  }
}

function Actions({ s, p, canQuote, onQuote }: { s: PersonSheetStyles; p: SePersonProfile; canQuote: boolean; onQuote: () => void }) {
  const share = shareAddress(p.id);
  return (
    <View style={s.actions}>
      {canQuote ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.openQuote(p.name)} onPress={onQuote} style={s.primary}>
          <Text style={s.primaryLabel}>{W.request}</Text>
        </TouchableOpacity>
      ) : null}
      {p.quora ? (
        <ShareLink url={p.quora} label={W.quora} title={W.quoraTitle} accessibilityLabel={W.quoraFor(p.name)} triggerStyle={s.pill} labelStyle={s.pillLabel} />
      ) : null}
      {share ? <ShareLink url={share} label={W.share} title={W.shareTitle} accessibilityLabel={W.shareFor(p.name)} triggerStyle={s.pill} labelStyle={s.pillLabel} /> : null}
    </View>
  );
}

function Skills({ s, p }: { s: PersonSheetStyles; p: SePersonProfile }) {
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.label}>
        {W.skills}
      </Text>
      {p.skills.length + p.pendingSkills.length === 0 ? <Text style={s.soft}>{W.noSkills}</Text> : null}
      <View style={s.chips}>
        {p.skills.map((skill) => (
          <Text key={skill} style={s.chip}>
            {skill}
          </Text>
        ))}
        {p.pendingSkills.map((skill) => (
          <Text key={`pending-${skill}`} accessibilityHint={W.pendingHint} style={s.pending}>
            {skill} · {W.pending}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Body({ s, p, viewerId, canQuote, onQuote }: { s: PersonSheetStyles; p: SePersonProfile; viewerId: string | null; canQuote: boolean; onQuote: () => void }) {
  const own = viewerId !== null && p.claimedByUserId === viewerId;
  return (
    <>
      <Identity s={s} p={p} />
      <Actions s={s} p={p} canQuote={canQuote} onQuote={onQuote} />
      {p.quora ? null : (
        <View style={s.note}>
          <Text style={s.noteText}>
            <Text style={s.strong}>{W.noQuora}</Text> {W.noQuoraText}
          </Text>
        </View>
      )}
      {p.bio ? (
        <View style={s.section}>
          <Text accessibilityRole="header" style={s.label}>
            {W.about}
          </Text>
          <Text style={s.bio}>{p.bio}</Text>
        </View>
      ) : null}
      <Skills s={s} p={p} />
      {p.claimedByUserId && !own ? <BlockMemberButton targetUserId={p.claimedByUserId} displayName={p.name} /> : null}
    </>
  );
}

export function ProfileSheet({ t, profileId, name, viewerId, canQuote, onQuote, onClose }: Props) {
  const s = useMemo(() => makePersonSheetStyles(t), [t]);
  const [attempt, setAttempt] = useState(0);
  const read = usePersonProfile(profileId, attempt);
  return (
    <PersonSheetFrame t={t} s={s} title={W.profileTitle} label={`${W.profileTitle}: ${name}`} onClose={onClose}>
      <SheetStatus
        s={s}
        loading={read.kind === 'loading' ? W.loadingProfile : null}
        failed={read.kind === 'failed' ? read.message : null}
        onRetry={() => setAttempt((n) => n + 1)}
      />
      {read.kind === 'ready' ? <Body s={s} p={read.value} viewerId={viewerId} canQuote={canQuote} onQuote={onQuote} /> : null}
    </PersonSheetFrame>
  );
}
