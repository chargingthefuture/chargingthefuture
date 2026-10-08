/**
 * Foundation — the Android app's Foundation screen, all of it, copied from the web FoundationShell
 * (components/foundation/foundation-shell.tsx): the Browse, Offer and Quotes tabs, a provider's profile
 * with Request Quote and Connect now, the Direct Line chat, and Recurring Activity opened from "See your
 * ongoing arrangements". A signed-out visitor sees the web's signed-out Foundation page. The incoming
 * ring and the call itself are drawn by FoundationCallController at the app shell, above every screen,
 * as the web mounts its call controller around every Foundation screen.
 *
 * The app's screen header follows what is open (ScreenOverride): the web header's refresh button on
 * the tabs, and on a profile, a Direct Line or Recurring Activity a back (the header chevron and
 * Android's back button) that returns to the Foundation screen it came from.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HeartHandshake } from 'lucide-react-native';
import { useAuth } from '../../auth/auth-context';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { useScreenOverride, type ScreenOverride } from '../../components/shell/ScreenOverride';
import type { ChatCredentials, ProviderView, QuoteView } from './FoundationDataApi';
import { useFoundationData, useRequestQuote } from './useFoundationData';
import { FoundationMain, type FoundationTab } from './FoundationMain';
import { ProviderProfile } from './FoundationProfile';
import { DirectLine } from './FoundationDirectLine';
import { FoundationPublic } from './FoundationPublic';
import { FoundationNavContext } from './FoundationNav';
import { RecurringActivity } from './recurring/RecurringActivity';
import { useRATheme } from './recurring/raShared';
import { font, useFDTheme } from './useFDTheme';

type OpenDirectLine = {
  credentials: ChatCredentials | null;
  threadId: string | null;
  subtitle: string | null;
  providerUserId: string | null;
};

// The provider on a Direct Line, for the "Is this ongoing?" prompt — only when the viewer is not that
// provider. Null hides the prompt.
function counterparty(providerUserId: string | null, viewerUserId: string | null): string | null {
  return !providerUserId || providerUserId === viewerUserId ? null : providerUserId;
}

function useShellState() {
  const [tab, setTab] = useState<FoundationTab>('browse');
  const [query, setQuery] = useState('');
  const [skillId, setSkillId] = useState<string | null>(null);
  const [skillName, setSkillName] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProviderView | null>(null);
  const [directLine, setDirectLine] = useState<OpenDirectLine | null>(null);
  const [recurring, setRecurring] = useState(false);
  const data = useFoundationData(query.trim(), skillId);

  // Land in the Direct Line when the thread came back with chat credentials, otherwise on Quotes so the
  // request is never lost.
  const onLanded = useCallback((credentials: ChatCredentials | null, provider: ProviderView) => {
    setSelected(null);
    if (credentials) setDirectLine({ credentials, threadId: null, subtitle: provider.displayName, providerUserId: provider.providerUserId });
    else setTab('quotes');
  }, []);
  const quote = useRequestQuote(data.loadQuotes, onLanded);

  // The web's Direct Line back: after Request Quote it opens Quotes; from a quote row it just closes.
  const closeDirectLine = useCallback(() => {
    setDirectLine((open) => {
      if (open?.credentials) setTab('quotes');
      return null;
    });
  }, []);
  const resetQuote = quote.reset;
  const closeProfile = useCallback(() => {
    setSelected(null);
    resetQuote();
  }, [resetQuote]);

  return {
    tab, setTab, query, setQuery, skillId, skillName, setSkillId, setSkillName,
    selected, setSelected, directLine, setDirectLine, recurring, setRecurring,
    data, quote, closeDirectLine, closeProfile,
  };
}

type Shell = ReturnType<typeof useShellState>;

function useShellOverride(s: Shell) {
  const ra = useRATheme().t;
  const { recurring, directLine, selected, data, closeDirectLine, closeProfile, setRecurring } = s;
  const onMain = !data.loading && !data.error;
  const override = useMemo<ScreenOverride | null>(() => {
    if (recurring) {
      return { onBack: () => setRecurring(false), title: 'Recurring Activity', icon: <HeartHandshake size={18} color={ra.ACCENT} />, accent: ra.ACCENT };
    }
    if (directLine) return { onBack: closeDirectLine };
    if (selected) return { onBack: closeProfile };
    return onMain ? { refresh: { onRefresh: data.refresh } } : null;
  }, [recurring, directLine, selected, onMain, ra.ACCENT, closeDirectLine, closeProfile, setRecurring, data.refresh]);
  useScreenOverride(override);
}

function ShellView({ s }: { s: Shell }) {
  const { data, quote } = s;
  if (s.recurring) return <RecurringActivity />;
  if (data.loading) return <LoadingScreen />;
  if (data.error) {
    return (
      <View style={[styles.centered, { backgroundColor: '#0F1117' }]}>
        <Text style={[font(16), styles.errorText]}>{data.error}</Text>
      </View>
    );
  }
  if (s.directLine) {
    return (
      <DirectLine
        credentials={s.directLine.credentials}
        threadId={s.directLine.threadId}
        subtitle={s.directLine.subtitle}
        counterpartyUserId={counterparty(s.directLine.providerUserId, data.viewerUserId)}
        onBack={s.closeDirectLine}
      />
    );
  }
  if (s.selected) {
    const provider = s.selected;
    return (
      <ProviderProfile
        provider={provider}
        viewerUserId={data.viewerUserId}
        submitting={quote.submitting}
        quoteError={quote.quoteError}
        quoteSuccess={quote.quoteSuccess}
        onBack={s.closeProfile}
        onRequestQuote={() => void quote.request(provider)}
      />
    );
  }
  return <MainView s={s} />;
}

function MainView({ s }: { s: Shell }) {
  const { t } = useFDTheme();
  const { data } = s;
  return (
    <View style={[styles.fill, { backgroundColor: t.BG }]}>
      <FoundationMain
        tab={s.tab}
        onTabChange={s.setTab}
        query={s.query}
        onQueryChange={s.setQuery}
        providers={data.providers}
        viewerUserId={data.viewerUserId}
        onSelectProvider={s.setSelected}
        skillId={s.skillId}
        skillName={s.skillName}
        onSkillFilter={(id, name) => { s.setSkillId(id); s.setSkillName(name ?? null); }}
        searchActive={s.query.trim().length > 0}
        quotes={data.quotes}
        onOpenDirectLine={(q: QuoteView) => s.setDirectLine({ credentials: null, threadId: q.threadId, subtitle: q.serviceType, providerUserId: q.providerUserId })}
        onRespond={data.respondToQuote}
        onClose={data.closeQuote}
      />
    </View>
  );
}

function FoundationShell() {
  const s = useShellState();
  useShellOverride(s);
  const { setRecurring } = s;
  const nav = useMemo(() => ({ openRecurring: () => setRecurring(true) }), [setRecurring]);
  return (
    <FoundationNavContext.Provider value={nav}>
      <ShellView s={s} />
    </FoundationNavContext.Provider>
  );
}

export function Foundation() {
  const { isAuthenticated } = useAuth();
  // The app pads every screen; Foundation runs edge to edge like the web page, so it takes the padding back.
  return <View style={styles.bleed}>{isAuthenticated ? <FoundationShell /> : <FoundationPublic />}</View>;
}

const styles = StyleSheet.create({
  bleed: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#EF4444', textAlign: 'center' },
});
