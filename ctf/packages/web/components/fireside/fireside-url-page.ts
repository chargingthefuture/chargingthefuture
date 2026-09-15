"use client";

import { useCallback, useEffect, useState } from "react";

// The page number of a list, kept in the address bar.
//
// Required by the accessibility rule (rule 100): a paged list must put the page in the URL so it
// can be linked and so the back button works, say which range of how many is on screen, and clamp
// an out-of-range page rather than showing nothing. The clamping happens on the server, which
// answers with the page it actually used; this is the other two.
//
// Reads from `window.location` rather than `useSearchParams` for the same reason
// peer-programming-shell.tsx does: `useSearchParams` puts a Suspense boundary requirement on a
// client shell, and these shells are rendered inside a dynamic route that has no boundary to give.
// Writes with history.pushState rather than the router, so paging does not re-run a server segment
// and does not disturb the app's own navigation history tracking beyond the entry it adds.

function readPage(param: string): number {
  if (typeof window === "undefined") return 1;
  const raw = Number.parseInt(new URLSearchParams(window.location.search).get(param) ?? "1", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function useUrlPage(param: string): [number, (next: number) => void] {
  const [page, setPageState] = useState(1);

  // The first read happens after mount, not during render: the server renders this shell too, and
  // reading the address bar during render would make the two disagree.
  useEffect(() => {
    setPageState(readPage(param));
  }, [param]);

  // The back button steps through pages the member actually visited.
  useEffect(() => {
    function onPop() {
      setPageState(readPage(param));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [param]);

  const setPage = useCallback(
    (next: number) => {
      setPageState(next);
      if (typeof window === "undefined") return;
      const query = new URLSearchParams(window.location.search);
      // Page one is the default, so it does not need saying — it keeps a shared link tidy and
      // keeps the deep link from a blog post from growing a parameter it never asked for.
      if (next <= 1) query.delete(param);
      else query.set(param, String(next));
      const search = query.toString();
      window.history.pushState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    },
    [param],
  );

  return [page, setPage];
}
