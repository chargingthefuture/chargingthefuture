import type { Metadata } from 'next';
import { HandoffScreen } from '../../../components/auth/handoff-screen';

// Where the Android app's browser panel lands (lib/auth/web-sign-in.ts): it signs the member in with
// the one-time token after the # and goes on to the page asked for.

export const metadata: Metadata = { title: 'Signing in · Skills Economy', robots: { index: false } };

export default function HandoffPage() {
  return <HandoffScreen />;
}
