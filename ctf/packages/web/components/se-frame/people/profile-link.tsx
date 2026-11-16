'use client';

import { useEffect, useState } from 'react';
import { SE_PERSON_SHEET_WORDS as S, seOwnProfileIdFrom, sePersonSheetPath } from '@ctf/shared';
import { ShareLink } from '@/components/shared/share-link';
import { SE_PILL_STYLE } from './pill-style';

// A person's Skills Economy profile address, through the shared link control (the address shown,
// Copy link with "Copied!" read out, Open in new tab), as the Directory's profile link is. The
// address opens their profile sheet on People.
export function ProfileLink({ profileId, label, title, className }: { profileId: string; label: string; title: string; className?: string }) {
  return (
    <ShareLink url={sePersonSheetPath(profileId)} title={title} ariaLabel={label} className={className} triggerStyle={SE_PILL_STYLE}>
      {S.profileLink}
    </ShareLink>
  );
}

// The member's own Directory profile id (GET /api/directory/profile), or null while it loads, when
// they have no profile, or when it could not be read; the button is then left out.
function useOwnProfileId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/directory/profile', { cache: 'no-store' })
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

export function OwnProfileLink({ className }: { className?: string }) {
  const id = useOwnProfileId();
  return id ? <ProfileLink profileId={id} label={S.copyOwnProfile} title={S.ownProfileLinkTitle} className={className} /> : null;
}
