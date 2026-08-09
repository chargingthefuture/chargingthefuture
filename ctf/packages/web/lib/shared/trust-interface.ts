// Platform-owned interface for the Trust capability (owner decision 2026-08-03: strict plugin
// isolation). This file is the single sanctioned crossing point for Trust: plugins must import it,
// never lib/trust or components/trust directly. Keep it narrow — a new export needs a reason, and
// re-exporting whole modules is prohibited. Enforced by ctf/scripts/check-plugin-boundaries.mjs.
export { TrustWidgetCard } from 'components/trust/TrustWidgetCard';
export type { TrustPeerView, TrustUserExtension } from 'lib/trust/types';
