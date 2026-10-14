"use client";

import { useCallback, useState } from "react";
import { failureText, responseFailureText } from "lib/errors/client-failure";
import type { Match, Property, Tab } from "./shared";

// The listings and matches reads behind Browse, Matches and the Direct Line picker. A failed read
// comes back as a message and never as an empty list, because "no listings" and "the listings could
// not be read" must not look the same (rule 137). A failed reload keeps the list already on screen.

type ListRead<T> = { ok: true; items: T[] } | { ok: false; message: string };

const LISTINGS_READ_FAILURE = "Could not load the listings.";
const MATCHES_READ_FAILURE = "Could not load your matches.";

/** GET a list endpoint: the route's own message when it answered with an error, the screen's sentence when it never answered. */
async function readList<T>(url: string, op: string, fallback: string): Promise<ListRead<T>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, message: await responseFailureText(res, fallback, "member") };
    const data = (await res.json()) as { items?: T[] };
    return { ok: true, items: data.items ?? [] };
  } catch (caught) {
    return { ok: false, message: failureText(caught, { area: "lighthouse", op, fallback, audience: "member" }) };
  }
}

export function useLighthouseLists() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  // Browse shows all active public listings to seekers, so it reads the public listings endpoint —
  // not the current user's own listings (LighthouseHost fetches /api/lighthouse/my-properties).
  const reloadListings = useCallback(async () => {
    const read = await readList<Property>("/api/lighthouse/properties", "fetch_listings", LISTINGS_READ_FAILURE);
    if (read.ok) setProperties(read.items);
    setListingsError(read.ok ? null : read.message);
  }, []);

  // Re-read after a request is sent, and on every refresh.
  const reloadMatches = useCallback(async () => {
    const read = await readList<Match>("/api/lighthouse/matches", "fetch_matches", MATCHES_READ_FAILURE);
    if (read.ok) setMatches(read.items);
    setMatchesError(read.ok ? null : read.message);
  }, []);

  return { properties, matches, listingsError, matchesError, reloadListings, reloadMatches };
}

/** The failed read behind the open tab, if any, and whether there is a previous list to keep showing. */
export function tabReadFailure(
  tab: Tab,
  lists: { properties: Property[]; matches: Match[]; listingsError: string | null; matchesError: string | null },
): { message: string | null; nothingToShow: boolean } {
  if (tab === "browse") return { message: lists.listingsError, nothingToShow: lists.properties.length === 0 };
  if (tab === "matches" || tab === "chat") return { message: lists.matchesError, nothingToShow: lists.matches.length === 0 };
  return { message: null, nothingToShow: false };
}

export function ListReadError({ message }: { message: string }) {
  return (
    <div role="alert" style={{ margin: "12px 16px 0", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#EF4444", fontSize: 13, lineHeight: 1.5 }}>
      {message}
    </div>
  );
}
