// Your account — the Android copy of the web /account hub (components/account/account-hub-shell.tsx).
// The gear opens it. The header above it ("Your account", back to Apps) is the shared ScreenHeader
// in src/navigation/AppHeader.tsx, as the web hub uses the shared MobileScreenHeader.
//
// Every section of the web hub is here: the heading and intro, Identity (with the account menu,
// where sign out lives, as the web's Clerk account menu sits on that card), Trust, Your ongoing
// activities, Verification, and Data & privacy. Recurring activity and Verification open the app's
// Recurring Activity and Unlock screens.
//
// The web renders this page on the server with the Trust signals already read. Here they load after
// the screen opens, so the Trust card appears once they arrive; if the read fails the card shows the
// empty state, as the web does when its read fails.

import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Database, HeartHandshake, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react-native';
import { reportError } from '../../observability/report';
import { TrustCard } from './trust/TrustCard';
import { fetchOwnTrust, type TrustPeerEvidenceItem } from './trust/api';
import { useAuth } from '../../auth/auth-context';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { UserMenuButton } from '../../components/shared/SessionControls';
import { getAccountTokens, radius, type AccountTokens } from './tokens';
import { useInterfaceVersion } from '../se-frame/interface-version';

function useOwnTrust(): TrustPeerEvidenceItem[] | null {
  const [evidence, setEvidence] = useState<TrustPeerEvidenceItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchOwnTrust()
      .then((trust) => { if (live) setEvidence(trust.trustEvidence ?? []); })
      .catch((caught) => {
        reportError(caught, { area: 'account', op: 'trust_self_read' });
        if (live) setEvidence([]);
      });
    return () => { live = false; };
  }, []);
  return evidence;
}

export function AccountHub({
  onOpenData,
  onOpenBlocks,
  onOpenVerification,
  onOpenRecurring,
  onOpenHome,
}: {
  onOpenData: () => void;
  onOpenBlocks: () => void;
  onOpenVerification: () => void;
  onOpenRecurring: () => void;
  onOpenHome: () => void;
}) {
  const { user } = useAuth();
  const evidence = useOwnTrust();
  const { tokens } = useTheme();
  const tok = getAccountTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const username = user?.username && user.username !== 'guest' ? user.username : null;
  const handle = username ? `@${username}` : 'Member';
  const initial = username ? username.charAt(0).toUpperCase() : 'S';

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.h1}>Your account</Text>
        <Text style={s.intro}>
          You have one identity across Skills Economy. Here is everywhere it shows up — update each part where it lives.
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>Identity</Text>
        <View style={s.identityRow}>
          <View style={s.initialTile}>
            <Text style={s.initialText}>{initial}</Text>
          </View>
          <View style={s.identityBody}>
            <Text style={s.handle}>{handle}</Text>
            <Text style={s.identityDesc}>Your name, username, photo, and email</Text>
          </View>
          <UserMenuButton />
        </View>
      </View>

      <View style={s.card}>
        <View style={s.labelRow}>
          <Sparkles size={12} color={tok.SUBTLE} />
          <Text style={[s.sectionLabel, s.labelInRow]}>Trust</Text>
        </View>
        {evidence ? <TrustCard evidence={evidence} /> : null}
        <Text style={s.trustNote}>
          Trust is earned by taking part — completing your profile, making a transaction, and using the plugins. There is nothing to fill in here.
        </Text>
      </View>

      <View style={s.card}>
        <View style={s.labelRow}>
          <HeartHandshake size={12} color={tok.SUBTLE} />
          <Text style={[s.sectionLabel, s.labelInRow]}>Your ongoing activities</Text>
        </View>
        <AccountLinkRow
          s={s}
          tok={tok}
          icon={<HeartHandshake size={18} color={tok.BRAND} />}
          title="Recurring activity"
          desc="Acknowledge the ongoing ties you share with another member. Recognition, never a bill — and yours to keep private."
          onPress={onOpenRecurring}
          last
        />
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>Verification</Text>
        <AccountLinkRow
          s={s}
          tok={tok}
          icon={<ShieldCheck size={18} color={tok.BRAND} />}
          title="Verification"
          desc="Confirm you are a real person with your Quora profile to unlock full access."
          onPress={onOpenVerification}
          last
        />
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>Data & privacy</Text>
        <AccountLinkRow
          s={s}
          tok={tok}
          icon={<Database size={18} color={tok.BRAND} />}
          title="Your data & deletion"
          desc="See everything the platform stores about you, and delete it — one service or your entire account."
          onPress={onOpenData}
        />
        <AccountLinkRow
          s={s}
          tok={tok}
          icon={<ShieldOff size={18} color={tok.BRAND} />}
          title="Blocked members"
          desc="See who you've blocked and unblock them. Blocked people can't see or contact you, and they're never told."
          onPress={onOpenBlocks}
          last
        />
      </View>

      <InterfaceSwitchCard s={s} tok={tok} onSwitched={onOpenHome} />
    </ScrollView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

// Settings: the switch into 3.1, the social redesign, as on the web hub
// (components/account/interface-switch-section.tsx). The way back is on the Me tab inside 3.1.
function InterfaceSwitchCard({ s, tok, onSwitched }: { s: Styles; tok: AccountTokens; onSwitched: () => void }) {
  const { switchTo, saving, error } = useInterfaceVersion();
  const press = async () => {
    if (await switchTo('3.1')) onSwitched();
  };
  return (
    <View style={s.card}>
      <Text style={s.sectionLabel}>Settings</Text>
      <View style={[s.linkRow, { alignItems: 'flex-start' }]}>
        <View>
          <Sparkles size={18} color={tok.BRAND} />
        </View>
        <View style={s.linkBody}>
          <Text style={s.linkTitle}>Try Skills Economy 3.1</Text>
          <Text style={s.linkDesc}>The new look is still being built. You can go back to 3.0 at any time from the Me tab.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={() => void press()}
            style={[s.switchButton, saving ? { opacity: 0.6 } : null]}
          >
            <Text style={s.switchLabel}>{saving ? 'Switching…' : 'Switch to 3.1'}</Text>
          </TouchableOpacity>
          {error ? (
            <Text accessibilityRole="alert" style={[s.linkDesc, { color: tok.TEXT, marginTop: 8 }]}>
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function AccountLinkRow({
  s,
  tok,
  icon,
  title,
  desc,
  onPress,
  last = false,
}: {
  s: Styles;
  tok: AccountTokens;
  icon: ReactNode;
  title: string;
  desc: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={title}
      style={[s.linkRow, last ? null : s.linkRowDivider]}
    >
      <View>{icon}</View>
      <View style={s.linkBody}>
        <Text style={s.linkTitle}>{title}</Text>
        <Text style={s.linkDesc}>{desc}</Text>
      </View>
      <ChevronRight size={16} color={tok.SUBTLE} />
    </TouchableOpacity>
  );
}

function makeStyles(t: ThemeTokens, tok: AccountTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tok.BG },
    content: { paddingTop: 32, paddingHorizontal: 20, paddingBottom: 64 },
    header: { marginBottom: 24 },
    h1: { fontSize: 24, fontFamily: interFamily('800'), color: tok.TEXT, marginBottom: 6 },
    intro: { fontSize: 14, lineHeight: 22.4, fontFamily: interFamily('400'), color: tok.SUBTLE },
    card: {
      backgroundColor: tok.SURFACE,
      borderWidth: 1,
      borderColor: tok.BORDER,
      borderRadius: radius(t, 14),
      paddingVertical: 18,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: interFamily('700'),
      letterSpacing: 0.88,
      textTransform: 'uppercase',
      color: tok.SUBTLE,
      marginBottom: 10,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    labelInRow: { marginBottom: 0 },
    trustNote: { fontSize: 12, lineHeight: 19.2, fontFamily: interFamily('400'), color: tok.SUBTLE },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    initialTile: {
      width: 48,
      height: 48,
      borderRadius: radius(t, 12),
      backgroundColor: `${tok.BRAND}22`,
      borderWidth: 1,
      borderColor: `${tok.BRAND}44`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialText: { fontSize: 18, fontFamily: interFamily('800'), color: tok.BRAND },
    identityBody: { flex: 1, minWidth: 0 },
    handle: { fontSize: 16, fontFamily: interFamily('700'), color: tok.TEXT },
    identityDesc: { fontSize: 13, fontFamily: interFamily('400'), color: tok.SUBTLE },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
    linkRowDivider: { borderBottomWidth: 1, borderBottomColor: tok.BORDER },
    linkBody: { flex: 1, minWidth: 0 },
    linkTitle: { fontSize: 14, fontFamily: interFamily('600'), color: tok.TEXT },
    linkDesc: { fontSize: 12, lineHeight: 18, fontFamily: interFamily('400'), color: tok.SUBTLE },
    switchButton: {
      alignSelf: 'flex-start',
      marginTop: 10,
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: tok.BORDER,
      backgroundColor: tok.SURFACE,
    },
    switchLabel: { fontSize: 14, fontFamily: interFamily('600'), color: tok.TEXT },
  });
}
