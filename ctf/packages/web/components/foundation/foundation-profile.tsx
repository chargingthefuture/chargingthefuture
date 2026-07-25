"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Shield } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { FONT, getFoundationTokens, initials, type ProviderView } from "./foundation-ui";
import { ConnectNowButton, InstantCallAvailabilityBadge, canOfferConnectNow, acceptsInstantCalls, isOwnProfile } from "./foundation-connect-now";
import { ShareLink } from "@/components/shared/share-link";

export function ProviderProfile({
  provider, viewerUserId = null, submitting, quoteError, quoteSuccess, onBack, onRequestQuote,
}: {
  provider: ProviderView;
  viewerUserId?: string | null;
  submitting: boolean;
  quoteError: string | null;
  quoteSuccess: boolean;
  onBack: () => void;
  onRequestQuote: () => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const ownProfile = isOwnProfile(provider, viewerUserId);
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: t.BG, fontFamily: FONT, color: t.TEXT, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${t.ACCENT}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
        <button onClick={onBack} style={{ color: t.ACCENT, background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: t.TITLE }}>Provider Profile</div>
        {/* Share this provider — the one app-wide control (rule 130). The link opens the auth-gated
            deep-link page: a signed-in member lands on this provider, an unauthenticated visitor is
            redirected to the Foundation landing. */}
        <div style={{ color: t.ACCENT, fontSize: 14, fontWeight: 700 }}>
          <ShareLink url={`/apps/foundation/provider/${provider.profileId}`} title="Share this provider" />
        </div>
      </div>
      <div style={{ flex: 1, padding: "24px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto", width: "100%", minWidth: 0 }}>
          {/* Header: on desktop a single row (avatar + identity fill the left, actions sit at the right).
              On phone width the actions drop to their own full-width block below the identity so nothing
              runs off-screen. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 20, marginBottom: 28 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1, minWidth: 0 }}>
              <Avatar style={{ width: 80, height: 80, flexShrink: 0 }}>
                <AvatarFallback style={{ background: `${t.ACCENT}25`, color: t.ACCENT, fontSize: 28, fontWeight: 800 }}>{initials(provider.displayName)}</AvatarFallback>
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>{provider.displayName}</div>
                {provider.headline && <div style={{ fontSize: 15, color: t.SUBTLE }}>{provider.headline}</div>}
                {/* Location read from the provider's shared directory profile — only the parts that are set. */}
                {[provider.city, provider.state, provider.country].some((v) => v && v.trim()) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: t.MUTED, marginTop: 5 }}>
                    <MapPin size={13} style={{ flexShrink: 0 }} />
                    <span>{[provider.city, provider.state, provider.country].map((v) => v?.trim()).filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flexShrink: 0 }}>
              {/* You can't request a quote from your own profile — the server rejects a self-connection,
                  so disable the button here rather than let the request fail with a generic error. */}
              <button
                type="button"
                onClick={onRequestQuote}
                disabled={submitting || ownProfile}
                title={ownProfile ? "This is your own profile — you can't request a quote from yourself." : undefined}
                style={{ padding: "10px 20px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: ownProfile ? "not-allowed" : submitting ? "default" : "pointer", opacity: submitting || ownProfile ? 0.5 : 1 }}
              >
                {submitting ? "Requesting…" : "Request Quote"}
              </button>
              {ownProfile && (
                <div style={{ fontSize: 12, color: t.MUTED, maxWidth: "100%", lineHeight: 1.5 }}>
                  This is your own profile — you can&apos;t request a quote from yourself.
                </div>
              )}
              {canOfferConnectNow(provider, viewerUserId) ? (
                <ConnectNowButton provider={provider} />
              ) : acceptsInstantCalls(provider) ? (
                <InstantCallAvailabilityBadge provider={provider} />
              ) : null}
            </div>
          </div>
          {quoteError && <div style={{ fontSize: 13, color: "#EF4444", marginBottom: 12 }}>{quoteError}</div>}
          {quoteSuccess && <div style={{ fontSize: 13, color: "#22C55E", marginBottom: 12 }}>Quote requested. Check the Quotes tab.</div>}
          {/* Provider's own short blurb, before the skills and About sections. */}
          {provider.shortDescription && (
            <div style={{ fontSize: 14, color: t.SUBTLE, lineHeight: 1.6, marginBottom: 16 }}>{provider.shortDescription}</div>
          )}
          {provider.offeredSkills.length > 0 && (
            <div style={{ padding: "20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}18`, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 10 }}>Willing to be contacted about</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {provider.offeredSkills.map((s) => (
                  <span key={s.id} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: `${t.ACCENT}12`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30` }}>{s.name}</span>
                ))}
              </div>
            </div>
          )}
          {provider.bio && (
            <div style={{ padding: "20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}18` }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 10 }}>About</div>
              <div style={{ fontSize: 14, color: t.SUBTLE, lineHeight: 1.7 }}>{provider.bio}</div>
            </div>
          )}
        </div>
        {/* On phone width the two columns stack (flex-direction: column), so this "Good to know" panel
            renders full-width at the very bottom, beneath the skills and About. On desktop it stays the
            right-hand sidebar column. */}
        <div style={{ flex: "0 0 auto", width: "100%", minWidth: 0 }}>
          <div style={{ padding: "16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Shield size={14} style={{ color: t.ACCENT }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT }}>Good to know</span>
            </div>
            <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>This provider is a fellow community member, not a formally vetted service.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
