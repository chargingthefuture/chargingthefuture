import { ShieldOff, UserCheck } from 'lucide-react';

// What a member sees when their account has been closed. Two versions, because the two reasons call for
// genuinely different things from the reader.
//
// A duplicate is a real person who already has an account here — the same Quora profile signed up again
// under a different email, which is ordinary and common. The useful thing to tell them is that their
// first account still works and how to get back to it. Saying only "closed" would strand somebody whose
// account is sitting right there.
//
// A closed-for-spam account gets a plain statement and one route to a human. No invitation to sign in
// as somebody else, because there is nobody else.
//
// Both keep the link to the provider's hosted account portal: managing or deleting their own identity is
// the one action a closed account can still take, and it is what makes this a door rather than a wall.

const QUORA_HELP_URL = 'https://skillseconomy.quora.com';

function ActionLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 20px',
        borderRadius: 11,
        background: primary ? '#C084FC' : 'rgba(255,255,255,0.06)',
        border: primary ? 'none' : '1px solid rgba(255,255,255,0.14)',
        color: primary ? '#1A1030' : '#E5E7EB',
        fontSize: 14,
        fontWeight: 700,
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
  );
}

export function AccountClosedNotice({
  isDuplicate,
  signInUrl,
  manageAccountUrl,
}: {
  isDuplicate: boolean;
  signInUrl: string;
  manageAccountUrl: string | null;
}) {
  const Icon = isDuplicate ? UserCheck : ShieldOff;
  const accent = isDuplicate ? '#C084FC' : '#9CA3AF';

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#0F1117',
        color: '#F9FAFB',
        fontFamily: "'Inter',system-ui,sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `${accent}1A`,
            border: `1px solid ${accent}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Icon size={26} color={accent} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>
          {isDuplicate ? 'You already have an account' : 'This account has been closed'}
        </h1>

        <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, margin: '0 0 10px' }}>
          {isDuplicate
            ? 'This sign-up uses the same Quora profile as an account that already exists here, so this one has been closed. Nothing has happened to your original account — sign in with the email you used the first time and everything is where you left it.'
            : 'A reviewer closed this account, so it can no longer be used here.'}
        </p>
        <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, margin: '0 0 24px' }}>
          {isDuplicate
            ? 'If you would rather not keep this second one, you can delete it from your account settings.'
            : `If you think that is a mistake, say so at ${QUORA_HELP_URL.replace('https://', '')} and a human will look again.`}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {isDuplicate ? <ActionLink href={signInUrl} label="Sign in to your other account" primary /> : null}
          {manageAccountUrl ? (
            <ActionLink href={manageAccountUrl} label="Manage or delete this account" primary={!isDuplicate} />
          ) : null}
          {isDuplicate ? null : <ActionLink href={QUORA_HELP_URL} label="Ask a human" />}
        </div>
      </div>
    </main>
  );
}
