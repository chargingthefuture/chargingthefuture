// Which rooms the member has open in the 3.1 frame, the Android copy of the web
// (web components/se-frame/rooms/se-rooms.tsx). A room stays mounted while the member is in its
// call, so moving between tabs never drops the audio: the room screen is hidden and a bar above the
// tab bar shows it instead. A room opened and left without joining is unmounted on the way out.

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SeTodayTalk } from '@ctf/shared';
import type { ChymeRoomScope } from '../../chyme/ChymeApi';

export type SeRoomSummary = { joined: boolean; name: string; count: number };

type SeRoomsValue = {
  opened: ChymeRoomScope[];
  shown: ChymeRoomScope | null;
  talks: Partial<Record<ChymeRoomScope, SeTodayTalk | null>>;
  summaries: Partial<Record<ChymeRoomScope, SeRoomSummary>>;
  open: (_scope: ChymeRoomScope, _talk?: SeTodayTalk | null) => void;
  minimize: () => void;
  report: (_scope: ChymeRoomScope, _summary: SeRoomSummary, _leave: () => void) => void;
  leave: (_scope: ChymeRoomScope) => void;
};

const SeRoomsContext = createContext<SeRoomsValue | null>(null);

export function useSeRooms(): SeRoomsValue {
  const value = useContext(SeRoomsContext);
  if (!value) throw new Error('useSeRooms must be used inside SeRoomsProvider.');
  return value;
}

export function SeRoomsProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState<ChymeRoomScope[]>([]);
  const [shown, setShown] = useState<ChymeRoomScope | null>(null);
  const [talks, setTalks] = useState<SeRoomsValue['talks']>({});
  const [summaries, setSummaries] = useState<SeRoomsValue['summaries']>({});
  const leaves = useRef<Partial<Record<ChymeRoomScope, () => void>>>({});

  const open = useCallback((scope: ChymeRoomScope, talk?: SeTodayTalk | null) => {
    setOpened((current) => (current.includes(scope) ? current : [...current, scope]));
    if (talk !== undefined) setTalks((current) => ({ ...current, [scope]: talk }));
    setShown(scope);
  }, []);

  const close = useCallback((scope: ChymeRoomScope) => {
    setOpened((current) => current.filter((item) => item !== scope));
  }, []);

  const minimize = useCallback(() => {
    if (shown && !summaries[shown]?.joined) close(shown);
    setShown(null);
  }, [shown, summaries, close]);

  const report = useCallback((scope: ChymeRoomScope, summary: SeRoomSummary, leave: () => void) => {
    leaves.current[scope] = leave;
    setSummaries((current) => {
      const before = current[scope];
      if (before && before.joined === summary.joined && before.name === summary.name && before.count === summary.count) return current;
      return { ...current, [scope]: summary };
    });
  }, []);

  // Leaving from the bar: the room's own leave runs, then the room is unmounted.
  const leave = useCallback(
    (scope: ChymeRoomScope) => {
      leaves.current[scope]?.();
      close(scope);
    },
    [close],
  );

  const value = useMemo<SeRoomsValue>(
    () => ({ opened, shown, talks, summaries, open, minimize, report, leave }),
    [opened, shown, talks, summaries, open, minimize, report, leave],
  );
  return <SeRoomsContext.Provider value={value}>{children}</SeRoomsContext.Provider>;
}
