'use client';

import { SE_ME_EMPTY_PROMPTS } from '@ctf/shared';
import type { ShellCurrentUser } from '../../community-shell/shell-types';
import type { SePrefs } from '../use-se-prefs';
import { MarkedList } from './marked-list';
import { MeScreen } from './me-screen';
import { PromptsEditor } from './prompts-editor';
import { SettingsScreen } from './settings-screen';
import { ThemeScreen } from './theme-screen';
import { useMeProfile } from './use-me-profile';
import { useMeView } from './use-me-view';

// The Me tab: Me, and the screens it opens in place (Settings and its Theme, Read, Hidden, and the
// profile lines). The open screen is kept in the address.

type MeTabProps = {
  currentUser: ShellCurrentUser;
  isAdmin: boolean;
  prefs: SePrefs;
  onAskArchitect: () => void;
  onBack: () => void;
  saving: boolean;
};

export function MeTab({ currentUser, prefs, onAskArchitect, onBack, saving }: MeTabProps) {
  const { view, open } = useMeView();
  const { state: profile, savePrompts } = useMeProfile();
  const toMe = () => open('me');
  if (view === 'theme') return <ThemeScreen theme={prefs.theme} onChange={prefs.setTheme} onBack={() => open('settings')} />;
  if (view === 'read' || view === 'hidden') return <MarkedList mark={view === 'read' ? 'done' : 'not_for_me'} onBack={toMe} />;
  if (view === 'prompts') {
    const prompts = profile.kind === 'ready' ? profile.profile.prompts : SE_ME_EMPTY_PROMPTS;
    return <PromptsEditor key={profile.kind} prompts={prompts} onSave={savePrompts} onDone={toMe} />;
  }
  if (view === 'settings') {
    return (
      <SettingsScreen
        theme={prefs.theme}
        reading={prefs.reading}
        onReading={prefs.setReading}
        onTheme={() => open('theme')}
        censusAdded={profile.kind === 'ready' ? profile.profile.censusAdded : null}
        onAskArchitect={onAskArchitect}
        onBackTo30={onBack}
        saving={saving}
        onClose={toMe}
      />
    );
  }
  return <MeScreen currentUser={currentUser} profile={profile} reading={prefs.reading} onReading={prefs.setReading} onOpen={open} />;
}
