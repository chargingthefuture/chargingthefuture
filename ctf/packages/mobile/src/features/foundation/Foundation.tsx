/**
 * Foundation — the Android app's Foundation screen, all of it, copied from the web FoundationShell
 * (components/foundation/foundation-shell.tsx): the Browse, Offer and Quotes tabs, a provider's profile
 * with Request Quote and Connect now, and the Direct Line chat. A signed-out visitor sees the web's
 * signed-out Foundation page. The incoming ring and the call itself are drawn by
 * FoundationCallController at the app shell, above every screen, as the web mounts its call controller
 * around every Foundation screen.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import type { ChatCredentials, ProviderView, QuoteView } from './FoundationDataApi';
import { useFoundationData, useRequestQuote } from './useFoundationData';
import { FoundationMain, type FoundationTab } from './FoundationMain';
import { ProviderProfile } from './FoundationProfile';
import { DirectLine } from './FoundationDirectLine';
import { FoundationPublic } from './FoundationPublic';
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

function FoundationShell() {
  const { t } = useFDTheme();
  const [tab, setTab] = useState<FoundationTab>('browse');
  const [query, setQuery] = useState('');
  const [skillId, setSkillId] = useState<string | null>(null);
  const [skillName, setSkillName] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProviderView | null>(null);
  const [directLine, setDirectLine] = useState<OpenDirectLine | null>(null);
  const searchTerm = query.trim();
  const data = useFoundationData(searchTerm, skillId);

  // Land in the Direct Line when the thread came back with chat credentials, otherwise on Quotes so the
  // request is never lost.
  const onLanded = useCallback((credentials: ChatCredentials | null, provider: ProviderView) => {
    setSelected(null);
    if (credentials) setDirectLine({ credentials, threadId: null, subtitle: provider.displayName, providerUserId: provider.providerUserId });
    else setTab('quotes');
  }, []);
  const quote = useRequestQuote(data.loadQuotes, onLanded);

  if (data.loading) return <LoadingScreen />;
  if (data.error) {
    return (
      <View style={[styles.centered, { backgroundColor: '#0F1117' }]}>
        <Text style={[font(16), styles.errorText]}>{data.error}</Text>
      </View>
    );
  }
  if (directLine) {
    return (
      <DirectLine
        credentials={directLine.credentials}
        threadId={directLine.threadId}
        subtitle={directLine.subtitle}
        counterpartyUserId={counterparty(directLine.providerUserId, data.viewerUserId)}
        onBack={() => {
          if (directLine.credentials) setTab('quotes');
          setDirectLine(null);
        }}
      />
    );
  }
  if (selected) {
    return (
      <ProviderProfile
        provider={selected}
        viewerUserId={data.viewerUserId}
        submitting={quote.submitting}
        quoteError={quote.quoteError}
        quoteSuccess={quote.quoteSuccess}
        onBack={() => { setSelected(null); quote.reset(); }}
        onRequestQuote={() => void quote.request(selected)}
      />
    );
  }
  return (
    <View style={[styles.fill, { backgroundColor: t.BG }]}>
      <FoundationMain
        tab={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        providers={data.providers}
        viewerUserId={data.viewerUserId}
        onSelectProvider={setSelected}
        skillId={skillId}
        skillName={skillName}
        onSkillFilter={(id, name) => { setSkillId(id); setSkillName(name ?? null); }}
        searchActive={searchTerm.length > 0}
        quotes={data.quotes}
        onOpenDirectLine={(q: QuoteView) => setDirectLine({ credentials: null, threadId: q.threadId, subtitle: q.serviceType, providerUserId: q.providerUserId })}
        onRespond={data.respondToQuote}
        onClose={data.closeQuote}
        refreshing={data.refreshing}
        onRefresh={data.refresh}
      />
    </View>
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
