'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SE_WW_ADD_WORDS as W, seWwAddsFrom, seWwSuggestHref, type SeTodayCard } from '@ctf/shared';
import { WwAddSheet } from './ww-add-sheet';

// "Add a problem" on the What works card opened in place on Today: the 3.1 add sheet, to the board
// "What works: add a problem". Use this and Add what helped go on to the What Works page with its
// suggest form open on that problem.
export function WwAddFromCard({ card, className }: { card: SeTodayCard; className: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!seWwAddsFrom(card.source)) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {W.title}
      </button>
      {open ? (
        <WwAddSheet
          onClose={() => setOpen(false)}
          onUse={(problemId) => router.push(seWwSuggestHref(problemId))}
          onAddWhatHelped={(problem) => router.push(seWwSuggestHref(problem.id, problem.title))}
        />
      ) : null}
    </>
  );
}
