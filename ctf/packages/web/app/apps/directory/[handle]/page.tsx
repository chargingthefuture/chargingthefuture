import { redirect } from 'next/navigation';

// v3 has no public directory profile view (unlike v2). Any deep-link into a
// per-handle/per-id directory URL — including legacy migration redirects that land
// here — is sent to the Directory shell, which renders the sign-in prompt for
// unauthenticated users. No profile data is exposed without auth.
export default async function DirectoryHandleRedirect() {
  redirect('/apps/directory');
}
