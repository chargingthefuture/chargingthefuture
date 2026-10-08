// The Foundation screen's data, the web FoundationShell's state and loads (foundation-shell.tsx): the
// provider search for the Browse tab, the member's quotes for the Quotes tab, Request Quote, and the two
// quote transitions.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchQuotes,
  requestQuote,
  searchProviders,
  transitionQuote,
  type ChatCredentials,
  type ProviderView,
  type QuoteView,
} from './FoundationDataApi';
import { reportError } from '../../observability/report';

export type QuoteTransitionResult = true | string;

export function useFoundationData(searchTerm: string, skillId: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteView[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedOnce = useRef(false);
  const refreshDone = useRef<(() => void) | null>(null);

  const loadQuotes = useCallback(async () => {
    setQuotes(await fetchQuotes());
  }, []);

  useEffect(() => {
    let active = true;
    // Only the first load covers the screen. A search, a skill filter or the header refresh reloads
    // under the screen, so the search box keeps its focus while the member types.
    if (!loadedOnce.current) setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [search] = await Promise.all([searchProviders(searchTerm, skillId), loadQuotes()]);
        if (!active) return;
        setProviders(search.items);
        setViewerUserId(search.viewerUserId);
      } catch (caught: unknown) {
        reportError(caught, { area: 'foundation', op: 'shell_load' });
        if (active) setError(caught instanceof Error ? caught.message : 'Failed to load Foundation.');
      } finally {
        if (active) {
          loadedOnce.current = true;
          setLoading(false);
          refreshDone.current?.();
          refreshDone.current = null;
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [searchTerm, skillId, loadQuotes, refreshKey]);

  // The header refresh button: resolves once the reload has finished, so its icon spins until then.
  const refresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        refreshDone.current = resolve;
        setRefreshKey((k) => k + 1);
      }),
    [],
  );

  const transition = useCallback(async (quoteId: string, body: Record<string, unknown>, fallback: string): Promise<QuoteTransitionResult> => {
    const result = await transitionQuote(quoteId, body, fallback);
    if (result !== true) return result;
    // Saved; a failed re-read only leaves the row showing its old state until the next load.
    try {
      await loadQuotes();
    } catch (caught) {
      reportError(caught, { area: 'foundation', op: 'quote_transition_reload' });
    }
    return true;
  }, [loadQuotes]);

  const respondToQuote = useCallback(
    (quote: QuoteView, quotedAmount: number, quotedCurrency: string) =>
      transition(quote.id, { transitionTo: 'provider_responded', quotedAmount, quotedCurrency }, 'Could not send the quote. Try again.'),
    [transition],
  );

  const closeQuote = useCallback(
    (quote: QuoteView) => transition(quote.id, { transitionTo: 'closed' }, 'Could not mark the work done. Try again.'),
    [transition],
  );

  return { loading, error, providers, viewerUserId, quotes, loadQuotes, refresh, respondToQuote, closeQuote };
}

// Request Quote's own state: submitting, the inline error and the confirmation.
export function useRequestQuote(loadQuotes: () => Promise<void>, onLanded: (_credentials: ChatCredentials | null, _provider: ProviderView) => void) {
  const [submitting, setSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState(false);

  const request = useCallback(async (provider: ProviderView) => {
    setSubmitting(true);
    setQuoteError(null);
    setQuoteSuccess(false);
    try {
      const credentials = await requestQuote(provider);
      setQuoteSuccess(true);
      loadQuotes().catch((caught: unknown) => reportError(caught, { area: 'foundation', op: 'quotes_reload_after_request' }));
      onLanded(credentials, provider);
    } catch (caught: unknown) {
      setQuoteError(caught instanceof Error ? caught.message : 'Failed to request quote.');
    } finally {
      setSubmitting(false);
    }
  }, [loadQuotes, onLanded]);

  const reset = useCallback(() => {
    setQuoteError(null);
    setQuoteSuccess(false);
  }, []);

  return { submitting, quoteError, quoteSuccess, request, reset };
}
