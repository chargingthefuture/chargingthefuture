import { CONTACT_EMAIL, OPERATOR_NAME } from '../../app/terms/policy-content';

// One footer for every public standalone page (/terms, /guidelines, /accessibility, /guide) so
// each carries the full link set (owner decision, 2026-07-19) — before this, each page linked a
// different subset and a visitor had to hop pages to find the rest. Server-renderable; inline
// styles so it sits over any page's own CSS module. Includes the current page's own link — a
// harmless no-op click that keeps the row identical everywhere.
const linkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'The app' },
  { href: 'https://chargingthefuture.com', label: 'ChargingTheFuture.com' },
  { href: '/terms', label: 'Terms & Privacy' },
  { href: '/guidelines', label: 'Community guidelines' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/guide', label: 'How to use it' },
];

export function PublicPageFooter() {
  return (
    <footer
      style={{
        marginTop: 36,
        paddingTop: 18,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: 13,
        lineHeight: 2,
        opacity: 0.85,
      }}
    >
      {OPERATOR_NAME} · Contact{' '}
      <a style={linkStyle} href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
      {LINKS.map((link) => (
        <span key={link.href}>
          {' '}
          ·{' '}
          <a style={linkStyle} href={link.href}>
            {link.label}
          </a>
        </span>
      ))}
    </footer>
  );
}
