// The Direct Line chat with a provider, copied from the web DirectLineFromQuote / DirectLineFromThread
// (foundation-direct-line.tsx): the back control and heading, the chat, and "Is this ongoing?" for the
// member who contacted the provider. Opened straight after Request Quote with the credentials the thread
// POST returned, or from a quote row, which reads fresh credentials for the thread.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { fetchDirectLine, type ChatCredentials } from './FoundationDataApi';
import { MarkRecurringControl } from './MarkRecurringControl';
import { alpha, font, useFDTheme } from './useFDTheme';
import { StreamChatView } from '../../components/shared/StreamChatView';
import { reportError } from '../../observability/report';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; credentials: ChatCredentials };

function useCredentials(given: ChatCredentials | null, threadId: string | null): LoadState {
  const [state, setState] = useState<LoadState>(given ? { status: 'ready', credentials: given } : { status: 'loading' });
  useEffect(() => {
    if (given || !threadId) return;
    let active = true;
    setState({ status: 'loading' });
    fetchDirectLine(threadId).then(
      (credentials) => { if (active) setState({ status: 'ready', credentials }); },
      (caught: unknown) => {
        reportError(caught, { area: 'foundation', op: 'direct_line_open' });
        if (active) setState({ status: 'error', message: caught instanceof Error ? caught.message : 'Could not open this Direct Line.' });
      },
    );
    return () => {
      active = false;
    };
  }, [given, threadId]);
  return state;
}

export function DirectLine({ credentials, threadId, subtitle, counterpartyUserId, onBack }: {
  credentials: ChatCredentials | null;
  threadId: string | null;
  subtitle: string | null;
  counterpartyUserId: string | null;
  onBack: () => void;
}) {
  const { t, r } = useFDTheme();
  const state = useCredentials(credentials, threadId);
  return (
    <View style={[styles.fill, { backgroundColor: t.BG }]}>
      <View style={[styles.header, { borderBottomColor: alpha(t.ACCENT, '20') }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.back, { borderRadius: r(10), backgroundColor: alpha(t.ACCENT, '14'), borderColor: alpha(t.ACCENT, '30') }]}>
          <ChevronLeft size={20} color={t.ACCENT} />
        </Pressable>
        <View style={styles.titles}>
          <Text style={[font(16, '700'), { color: t.TITLE }]}>Direct Line</Text>
          {subtitle ? <Text style={[font(12), { color: t.SUBTLE }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.fill}>
        {state.status === 'loading' ? <Text style={[font(14), styles.pad, { color: t.SUBTLE }]}>Opening Direct Line…</Text> : null}
        {state.status === 'error' ? <Text style={[font(14), styles.pad, { color: '#EF4444' }]}>{state.message}</Text> : null}
        {state.status === 'ready' ? (
          <StreamChatView
            streamApiKey={state.credentials.streamApiKey}
            streamToken={state.credentials.streamToken}
            streamUserId={state.credentials.streamUserId}
            streamChannelId={state.credentials.streamChannelId}
            accentColor={t.ACCENT}
          />
        ) : null}
      </View>
      {counterpartyUserId ? (
        <View style={[styles.footer, { borderTopColor: t.BORDER }]}>
          <MarkRecurringControl counterpartyUserId={counterpartyUserId} sectorLabel="ongoing work with this provider" accent={t.ACCENT} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  back: { width: 36, height: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, minWidth: 0 },
  pad: { padding: 24 },
  footer: { paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1 },
});
