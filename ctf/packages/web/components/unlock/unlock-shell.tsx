import { getUnlockStatusForUser } from 'lib/unlock/repository';
import { currentUser } from '@clerk/nextjs/server';
import { UnlockBrowser } from './unlock-browser';

export async function UnlockShell() {
  const user = await currentUser();
  if (!user) {
    return null;
  }

  const status = await getUnlockStatusForUser(user.id).catch(() => ({
    userId: user.id,
    accessTier: null,
    reviewStatus: null,
    unlockWindowExpiresAt: null,
    reminderStage: 0,
    incentiveGrantedAt: null,
    hasSubmission: false,
  }));

  return <UnlockBrowser initialStatus={status} />;
}
