"use client";

import { useEffect, useState } from "react";

// The sectors and skills a mission goal can name, read from the skills taxonomy. Missions match
// nominations by these names, so a typed name that is off by one letter counts nothing; picking
// from the taxonomy makes that impossible (owner report, 2026-10-01).
import { groupTaxonomyOptions, type TaxonomyFlattenedOptionRow, type TaxonomyOption, type TaxonomyOptions } from "lib/skills-hunt/taxonomy-options";

export type { TaxonomyOption, TaxonomyOptions };

let cached: Extract<TaxonomyOptions, { status: "ready" }> | null = null;

export function useTaxonomyOptions(): TaxonomyOptions {
  const [state, setState] = useState<TaxonomyOptions>(cached ?? { status: "loading" });
  useEffect(() => {
    if (cached) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/skills-taxonomy/flattened");
        const body = (await res.json().catch(() => null)) as { items?: TaxonomyFlattenedOptionRow[]; message?: string } | null;
        if (!res.ok) throw new Error(body?.message ?? `the taxonomy request failed (${res.status})`);
        cached = groupTaxonomyOptions(body?.items ?? []);
        if (active) setState(cached);
      } catch (e) {
        if (active) setState({ status: "error", message: `Sectors and skills could not be loaded: ${e instanceof Error ? e.message : "the request did not reach the server"}. Reload the page to try again.` });
      }
    })();
    return () => { active = false; };
  }, []);
  return state;
}
