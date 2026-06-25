// Loud, fixed banner shown across every /admin screen when the signed-in operator is a demo
// participant. Admin tools (approve, retry rewards, mint, burn) run against whichever DB schema the
// caller's demo flag selects (getActivePool -> isDemoMode), so a demo-mode operator can act on demo
// data without realising it — e.g. a governance burn that hits an empty demo wallet and fails as
// "Insufficient balance.". This makes the demo context impossible to miss. Rendered only in demo mode,
// so the normal production operator view is unchanged. Fixed-position so it never shifts a shell's
// own 100dvh layout.
export function AdminDemoBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: '#B45309',
        color: '#FFFFFF',
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "'Inter', system-ui, sans-serif",
        textAlign: 'center',
        lineHeight: 1.35,
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        borderBottom: '1px solid rgba(0,0,0,0.35)',
      }}
    >
      ⚠ Demo mode — you are acting on demo data, not production. Approvals, reward retries, mints, and
      burns here change the demo schema only. Turn off demo mode to operate production.
    </div>
  );
}
