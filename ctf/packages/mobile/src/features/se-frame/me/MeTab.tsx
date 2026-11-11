// The Me tab on Android, the copy of the web's me-tab.tsx: Me, and the screens it opens in place
// (Settings and its Theme, Read, Hidden, and the profile lines). The phone's back button returns to
// the screen before.

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { SE_ME_EMPTY_PROMPTS, type SeMeView, type SeThemeTokens } from '@ctf/shared';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import type { SePrefs } from '../useSePrefs';
import { SeFrameScrollContext } from '../frame-scroll';
import { MarkedList } from './MarkedList';
import { MeScreen, type MeUser } from './MeScreen';
import { SavedCard } from './SavedCard';
import { useMeProfile } from './meData';
import { PromptsEditor } from './PromptsEditor';
import { SettingsScreen } from './SettingsScreen';
import { ThemeScreen } from './ThemeScreen';

type Props = {
  t: SeThemeTokens;
  user: MeUser;
  prefs: SePrefs;
  onAskArchitect: () => void;
  onBack: () => void;
  saving: boolean;
  onOpen: (_key: FeatureKey) => void;
};

function useMeBack(view: SeMeView, setView: (_v: SeMeView) => void) {
  useEffect(() => {
    if (view === 'me') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setView(view === 'theme' ? 'settings' : 'me');
      return true;
    });
    return () => sub.remove();
  }, [view, setView]);
}

export function MeTab({ t, user, prefs, onAskArchitect, onBack, saving, onOpen }: Props) {
  const [view, setViewState] = useState<SeMeView>('me');
  const scrollToTop = useContext(SeFrameScrollContext);
  const setView = useCallback(
    (next: SeMeView) => {
      setViewState(next);
      scrollToTop?.();
    },
    [scrollToTop],
  );
  const { state: profile, savePrompts } = useMeProfile();
  useMeBack(view, setView);
  const go = (href: string) => openTodayLink(href, onOpen);
  const toMe = () => setView('me');
  if (view === 'theme') return <ThemeScreen t={t} theme={prefs.theme} onChange={prefs.setTheme} onBack={() => setView('settings')} />;
  if (view === 'read' || view === 'hidden') return <MarkedList t={t} mark={view === 'read' ? 'done' : 'not_for_me'} onBack={toMe} go={go} />;
  if (view === 'prompts') {
    const prompts = profile.kind === 'ready' ? profile.value.prompts : SE_ME_EMPTY_PROMPTS;
    return <PromptsEditor key={profile.kind} t={t} prompts={prompts} onSave={savePrompts} onDone={toMe} />;
  }
  if (view === 'settings') {
    return (
      <SettingsScreen
        t={t}
        theme={prefs.theme}
        reading={prefs.reading}
        onReading={prefs.setReading}
        onTheme={() => setView('theme')}
        censusAdded={profile.kind === 'ready' ? profile.value.censusAdded : null}
        onAskArchitect={onAskArchitect}
        onBackTo30={onBack}
        saving={saving}
        onClose={toMe}
        onOpen={onOpen}
        go={go}
      />
    );
  }
  return <MeScreen t={t} user={user} profile={profile} reading={prefs.reading} onReading={prefs.setReading} onView={setView} go={go} savedList={<SavedCard t={t} onOpen={onOpen} />} />;
}
