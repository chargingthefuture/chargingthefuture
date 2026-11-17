'use client';

import { useState, type ReactNode } from 'react';
import { SE_WW_ADD_WORDS as W, seWwAddsFrom, type SeTodayCard } from '@ctf/shared';
import { WwAddSheet, type WwAddedProblem } from './ww-add-sheet';
import { WwHelpedSheet } from './ww-helped-sheet';

// A button that opens the 3.1 add sheet, to the board "What works: add a problem". Use this and Add
// what helped go on to "What helped" in a 3.1 sheet of the same look, so nothing leaves 3.1. It
// opens from the What works card on Today and from + New → Offer.
export function WwAddButton({ className, children }: { className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [helped, setHelped] = useState<WwAddedProblem | null>(null);
  const toHelped = (problem: WwAddedProblem) => {
    setOpen(false);
    setHelped(problem);
  };
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? <WwAddSheet onClose={() => setOpen(false)} onUse={toHelped} onAddWhatHelped={toHelped} /> : null}
      {helped ? <WwHelpedSheet problem={helped} onClose={() => setHelped(null)} /> : null}
    </>
  );
}

// "Add a problem" on the What works card opened in place on Today.
export function WwAddFromCard({ card, className }: { card: SeTodayCard; className: string }) {
  if (!seWwAddsFrom(card.source)) return null;
  return <WwAddButton className={className}>{W.title}</WwAddButton>;
}
