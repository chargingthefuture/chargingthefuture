'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import { seAvatarDataUri } from '@ctf/shared';

// Clerk's account button with the member's generated picture in place of any uploaded photo. The
// photo itself is hidden for every Clerk screen by CLERK_NO_PHOTOS in app/layout.tsx.
export function SeUserButton({ boxClassName }: { boxClassName: string }) {
  const { user } = useUser();
  const picture = user ? { backgroundImage: `url("${seAvatarDataUri(user.id)}")`, backgroundSize: 'cover' } : {};
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: boxClassName,
          userButtonAvatarBox: picture,
          userPreviewAvatarBox: picture,
        },
      }}
    />
  );
}
