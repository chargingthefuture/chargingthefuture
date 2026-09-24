"use client";

import { useCallback } from "react";
import type { QuoteView } from "./foundation-ui";

const CSRF_HEADERS = { "Content-Type": "application/json", "x-ctf-csrf": "1" };

/**
 * The two quote lifecycle transitions the member-facing shell can send, lifted out of
 * `FoundationShell` so that component stays inside the 200-line governance limit (rule 116) and so
 * the two calls that drive the same route sit next to each other rather than in the middle of a
 * screen's state.
 *
 * Both return whether the POST succeeded rather than throwing: each caller is a small form that
 * shows its own inline failure and keeps what the member typed.
 *
 * `loadQuotes` is re-run after a successful transition so the row shows its new state without a
 * page refresh.
 */
export function useQuoteTransitions(loadQuotes: () => Promise<void> | void) {
  const transition = useCallback(
    async (quoteId: string, body: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await fetch(`/api/foundation/quotes/${encodeURIComponent(quoteId)}/state`, {
          method: "POST",
          headers: CSRF_HEADERS,
          body: JSON.stringify(body),
        });
        if (!res.ok) return false;
        await loadQuotes();
        return true;
      } catch {
        return false;
      }
    },
    [loadQuotes],
  );

  // The provider attaches a price to a quote still in 'requested'. Provider-only, enforced by the
  // server; the form is hidden from the other side but that check is not what makes it true.
  const respondToQuote = useCallback(
    (quote: QuoteView, quotedAmount: number, quotedCurrency: string): Promise<boolean> =>
      transition(quote.id, { transitionTo: "provider_responded", quotedAmount, quotedCurrency }),
    [transition],
  );

  // Either party marks a priced quote delivered. This stamps settled_at, which is what carries the
  // engagement into the Community Value Index. Nothing in the app sent this transition before
  // 2026-09-23, so a quote could be priced, the work done, and it would still count as nothing.
  const closeQuote = useCallback(
    (quote: QuoteView): Promise<boolean> => transition(quote.id, { transitionTo: "closed" }),
    [transition],
  );

  return { respondToQuote, closeQuote };
}
