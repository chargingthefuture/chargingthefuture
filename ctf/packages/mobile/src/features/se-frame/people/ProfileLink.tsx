// A person's Skills Economy profile address on Android, the copy of the web's profile-link.tsx,
// through the shared link control (the address shown, Open link, and the phone's share sheet, which
// has Copy). The address opens their profile sheet on People.

import React, { useEffect, useMemo, useState } from 'react';
import { SE_PERSON_SHEET_WORDS as S, seOwnProfileIdFrom, sePersonSheetPath, type SeThemeTokens } from '@ctf/shared';
import { authedFetch, getApiBaseUrl } from '../../../auth/authedFetch';
import { ShareLink } from '../../../components/shared/ShareLink';
import { makePersonSheetStyles } from './personSheetStyles';

function absolute(profileId: string): string | null {
  try {
    return `${getApiBaseUrl()}${sePersonSheetPath(profileId)}`;
  } catch {
    // no-trace: a build with no app address offers no profile link; the rest of the screen shows
    return null;
  }
}

type Props = { t: SeThemeTokens; profileId: string; label: string; title: string };

export function ProfileLink({ t, profileId, label, title }: Props) {
  const s = useMemo(() => makePersonSheetStyles(t), [t]);
  const url = absolute(profileId);
  if (!url) return null;
  return <ShareLink url={url} label={S.profileLink} title={title} accessibilityLabel={label} triggerStyle={s.pill} labelStyle={s.pillLabel} />;
}

// The member's own Directory profile id (GET /api/directory/profile), or null; the button is then
// left out, as on the web.
function useOwnProfileId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    authedFetch('/api/directory/profile')
      .then(async (res) => (res.ok ? seOwnProfileIdFrom(await res.json().catch(() => null)) : null))
      .then((next) => {
        if (live) setId(next);
      })
      .catch(() => {
        // no-trace: without the id the button is left out; nothing else on Me depends on it.
      });
    return () => {
      live = false;
    };
  }, []);
  return id;
}

export function OwnProfileLink({ t }: { t: SeThemeTokens }) {
  const id = useOwnProfileId();
  return id ? <ProfileLink t={t} profileId={id} label={S.copyOwnProfile} title={S.ownProfileLinkTitle} /> : null;
}
