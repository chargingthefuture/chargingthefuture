// Escape hatch for the public standalone pages (/terms, /guidelines, /accessibility, /guide).
// In the installed web app there is no browser chrome, so a member who follows a footer link onto
// these pages has no way back (owner report, 2026-07-19) — this row always offers the app and the
// public website. Server-renderable (no client hooks); inline styles so it sits above any page's
// own CSS module without coupling.
const linkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 9,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
};

export function PublicPageNav() {
  return (
    <nav
      aria-label="Leave this page"
      style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}
    >
      <a href="/" style={linkStyle}>
        ← Back to the app
      </a>
      <a href="https://chargingthefuture.com" style={linkStyle}>
        ChargingTheFuture.com
      </a>
    </nav>
  );
}
