import { LogIn } from 'lucide-react';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';

// Chrome colors via theme CSS variables (fallback = the exact shipped default hex, so the
// default theme is pixel-identical). This is a server component, so CSS vars — not useTheme().
const BG = 'var(--ctf-bg, #0F1117)';
const SURFACE = 'var(--ctf-surface, #161B27)';
const BORDER = 'var(--ctf-border, #1E2A3A)';
const TEXT = 'var(--ctf-text, #F9FAFB)';
const SUBTLE = 'var(--ctf-text-subtle, #6B7280)';
// Status green — no sanctioned default token (design-cohesion pass §F3); also used with the
// `${COLOR}NN` alpha-suffix trick that CSS var() cannot express. Keep raw.
const COLOR = '#22C55E';

/**
 * Generic signed-out visitor view, used for any plugin that does not yet have a
 * bespoke public shell wired into the registry. It shows the plugin name, a
 * short invitation, and a working sign-in affordance — no private or per-user
 * data. This keeps a signed-out visitor on a clean public page instead of the
 * access-denied wall while bespoke public shells are built out one plugin at a
 * time.
 */
export function GenericPublicShell({ pluginName, signInUrl, verifyUrl }: PublicVisitorShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: BG,
        fontFamily: "'Inter', system-ui, sans-serif",
        color: TEXT,
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: '32px 28px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: `${COLOR}15`,
            border: `1px solid ${COLOR}30`,
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: COLOR,
            marginBottom: 16,
          }}
        >
          Public preview
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PublicShellBackLink />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: '0 0 8px', lineHeight: 1.3 }}>
            {pluginName}
          </h1>
        </div>
        <p style={{ fontSize: 14, color: SUBTLE, margin: '0 0 24px', lineHeight: 1.6 }}>
          {verifyUrl
            ? `You're signed in — finish verifying your account to use ${pluginName}.`
            : `Sign in to join the survivor community and use ${pluginName}. This app does not have a public view yet; a free account is all it takes.`}
        </p>
        <a
          href={verifyUrl ?? signInUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 16px',
            borderRadius: 9,
            background: COLOR,
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          {verifyUrl ? 'Finish verifying' : <><LogIn size={15} /> Sign in</>}
        </a>
      </div>
    </div>
  );
}
