import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

/**
 * Inline back-to-/apps control for a plugin's public / not-yet-verified visitor
 * shell. It is designed to sit as the FIRST child of the shell's header row, on
 * the same line as the plugin icon/title, hard against the far left. Because it
 * is a normal-flow inline-flex element it reserves its own width in the row, so
 * it never overlaps the title (an earlier absolute overlay did) and never needs
 * a separate bar of its own.
 *
 * Verified members never see these public shells — they get the plugin's
 * authenticated shell, which has its own designed back button — so this control
 * only appears where one was missing.
 */
export function PublicShellBackLink() {
  return (
    <Link
      href="/apps"
      aria-label="Back to apps"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 8,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)',
        color: '#F9FAFB',
        textDecoration: 'none',
        marginRight: 2,
      }}
    >
      <ChevronLeft size={18} />
    </Link>
  );
}
