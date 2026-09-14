import type { Metadata } from 'next';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { isUserUnlocked } from 'lib/shared/unlock-interface';
import { readerIdentity } from 'lib/ti-radio/_lib';
import { getGuide } from 'lib/ti-radio/repository';
import { TiRadioGuideView } from '@/components/ti-radio/ti-radio-guide';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'TI Radio',
  description: 'A week of live discussions hosted by members. Read the schedule, or take an empty slot and host one.',
};

// /ti-radio — the guide, open to everyone.
//
// A top-level route rather than /apps/ti-radio, for the same reason the Knowledge Library has one:
// every /apps route sits behind the access gate, and this page has to render for somebody with no
// account at all. /apps/ti-radio redirects here before that gate, so the launcher tile still works.
//
// The three viewer states are read here from identity plus Unlock tier without collapsing to
// allow/deny, so a signed-out visitor gets the page rather than a wall.
export default async function TiRadioPage() {
  const reader = await readerIdentity();
  const approved = reader.userId ? await isUserUnlocked(reader.userId).catch(() => false) : false;
  const guide = await getGuide({
    userId: reader.userId,
    canHost: approved || reader.isAdmin,
    isAdmin: reader.isAdmin,
  });

  return (
    <TiRadioGuideView
      initialGuide={guide}
      signInUrl={getHostedSignInUrl() ?? '/sign-in'}
      verifyUrl="/plugin/unlock"
    />
  );
}
