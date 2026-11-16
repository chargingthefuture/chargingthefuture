'use client';

// Opens the "Add a problem" sheet over What Works, in What Works' own 3.0 look: from the suggest
// form, or straight away when the address carries ?add=problem. A problem the member adds waits for
// review, and is kept here as an option so they can add what helped with it before it is read.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SE_WW_ADD_WORDS } from '@ctf/shared';
import { useTheme } from '@/hooks/useTheme';
import { WwAddSheet, type WwAddedProblem } from '../se-frame/what-works/ww-add-sheet';
import { getWhatWorksTokens, type WhatWorksProblemOption } from './ww-shared';

function dropParams(names: string[]) {
  const url = new URL(window.location.href);
  if (!names.some((name) => url.searchParams.has(name))) return;
  names.forEach((name) => url.searchParams.delete(name));
  window.history.replaceState(window.history.state, '', url.toString());
}

function pendingOption(problem: WwAddedProblem): WhatWorksProblemOption {
  return { id: problem.id, slug: '', emoji: '', title: SE_WW_ADD_WORDS.waiting(problem.title), context: '' };
}

export function useWwAddEntry(openSuggest: (_problemId: string) => void): {
  openAdd: () => void;
  ownPending: WhatWorksProblemOption[];
  sheet: ReactNode;
} {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [ownPending, setOwnPending] = useState<WhatWorksProblemOption[]>([]);
  const addPending = useCallback((problem: WwAddedProblem) => {
    setOwnPending((prev) => [...prev.filter((p) => p.id !== problem.id), pendingOption(problem)]);
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === 'problem') setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    dropParams(['add']);
  }, []);
  const use = (problem: WwAddedProblem) => {
    close();
    openSuggest(problem.id);
  };
  const addWhatHelped = (problem: WwAddedProblem) => {
    addPending(problem);
    close();
    openSuggest(problem.id);
  };
  const sheet = open ? <WwAddSheet onClose={close} onUse={use} onAddWhatHelped={addWhatHelped} look={getWhatWorksTokens(theme)} /> : null;
  return { openAdd: () => setOpen(true), ownPending, sheet };
}
