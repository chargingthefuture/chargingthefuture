'use client';

import { useState, type ReactNode } from 'react';
import { SE_WW_ADD_WORDS as W, SE_WW_CARD_WORDS, seWwAddsFrom, seWwCardLink, type SeTodayCard } from '@ctf/shared';
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

// Add a solution to this problem: straight to "What helped" for the card's own problem.
function WwAddSolutionButton({ problem, className }: { problem: WwAddedProblem; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {SE_WW_CARD_WORDS.addSolution}
      </button>
      {open ? <WwHelpedSheet problem={problem} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// The What works card opened in place on Today: the solution's own link, then Add a solution to
// this problem first and Add a problem after it.
type FromCardProps = { card: SeTodayCard; className: string; primaryClassName: string; linkClassName: string };

export function WwAddFromCard({ card, className, primaryClassName, linkClassName }: FromCardProps) {
  if (!seWwAddsFrom(card.source)) return null;
  const ww = card.whatWorks;
  const link = seWwCardLink(ww?.link);
  return (
    <>
      {link ? (
        <span className={linkClassName}>
          {SE_WW_CARD_WORDS.link}:&nbsp;
          <a href={link} target="_blank" rel="noopener noreferrer nofollow">
            {link}
          </a>
        </span>
      ) : null}
      {ww ? <WwAddSolutionButton problem={{ id: ww.problemId, title: ww.problemTitle }} className={primaryClassName} /> : null}
      <WwAddButton className={className}>{W.title}</WwAddButton>
    </>
  );
}
