'use client';

// Opens the 3.1 "Add a problem" sheet over What Works: from the suggest form, or straight away
// when the address carries ?add=problem. A problem the member adds waits for review, and is kept
// here as an option so they can add what helped with it before it is read.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SE_WW_ADD_WORDS } from '@ctf/shared';
import { WwAddSheet, type WwAddedProblem } from '../se-frame/what-works/ww-add-sheet';
import type { WhatWorksProblemOption } from './ww-shared';

function dropAddParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('add')) return;
  url.searchParams.delete('add');
  window.history.replaceState(window.history.state, '', url.toString());
}

export function useWwAddEntry(openSuggest: (_problemId: string) => void): {
  openAdd: () => void;
  ownPending: WhatWorksProblemOption[];
  sheet: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [ownPending, setOwnPending] = useState<WhatWorksProblemOption[]>([]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === 'problem') setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    dropAddParam();
  }, []);
  const use = (problemId: string) => {
    close();
    openSuggest(problemId);
  };
  const addWhatHelped = (problem: WwAddedProblem) => {
    const option = { id: problem.id, slug: '', emoji: '', title: SE_WW_ADD_WORDS.waiting(problem.title), context: '' };
    setOwnPending((prev) => [...prev.filter((p) => p.id !== problem.id), option]);
    close();
    openSuggest(problem.id);
  };
  const sheet = open ? <WwAddSheet onClose={close} onUse={use} onAddWhatHelped={addWhatHelped} /> : null;
  return { openAdd: () => setOpen(true), ownPending, sheet };
}
