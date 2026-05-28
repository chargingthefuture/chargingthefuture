"use client";

import { useState } from "react";
import {
  Unlock as UnlockIcon, Bell, Settings, CheckCircle, Clock,
  XCircle, ExternalLink, ChevronRight, Shield, Users, RefreshCw,
} from "lucide-react";
import type { UnlockStatus } from "lib/unlock/types";

// API: GET /api/unlock/status  → { ok, status }
// API: POST /api/unlock/submission  → submit Quora URL

const BRAND = "#10B981";
const bg = "#0F1117";
const surface = "#161B27";
const border = "#1E2A3A";
const textColor = "#F9FAFB";
const subtle = "#6B7280";

type ReviewStatus = "pending" | "approved" | "rejected" | "none";

const STATUS_CONFIG: Record<Exclude<ReviewStatus, "none">, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", label: "Pending Review" },
  approved: { icon: CheckCircle, color: BRAND, bg: "rgba(16,185,129,0.08)", label: "Approved" },
  rejected: { icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.08)", label: "Rejected" },
};

type Props = {
  initialStatus: UnlockStatus;
};

export function UnlockBrowser({ initialStatus }: Props) {
  const reviewStatus: ReviewStatus = initialStatus.reviewStatus === "spam" ? "rejected" : (initialStatus.reviewStatus ?? "none");
  const cfg = reviewStatus !== "none" ? STATUS_CONFIG[reviewStatus] : null;
  const Icon = cfg?.icon ?? UnlockIcon;

  const [newUrl, setNewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!newUrl.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/unlock/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoraProfileUrl: newUrl.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? "Submission failed");
      setSubmitted(true);
      setNewUrl("");
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const showSubmitForm = !initialStatus.hasSubmission || reviewStatus === "rejected" || reviewStatus === "none";
  const currentStatus = submitted ? "pending" : reviewStatus;
  const currentCfg = currentStatus !== "none" ? STATUS_CONFIG[currentStatus as Exclude<ReviewStatus, "none">] : null;
  const CurrentIcon = currentCfg?.icon ?? UnlockIcon;

  return (
    <div style={{ display: "flex", height: "100vh", background: bg, fontFamily: "'Inter', system-ui, sans-serif", color: textColor, overflow: "hidden" }}>

      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <UnlockIcon size={20} color={BRAND} />
        </div>
        {[UnlockIcon, Shield, Users].map((Ic, i) => (
          <button key={i} style={{ width: 44, height: 44, borderRadius: 12, background: i === 0 ? `${BRAND}20` : "transparent", border: i === 0 ? `1px solid ${BRAND}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: i === 0 ? BRAND : subtle }}>
            <Ic size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Bell size={18} /></button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Settings size={18} /></button>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${BRAND}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: BRAND }}>S</div>
      </aside>

      {/* Left sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: subtle, textTransform: "uppercase", marginBottom: 4 }}>🔓 Unlock Access</div>
          <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>Verify your Quora profile to unlock full account access</div>
        </div>
        <div style={{ flex: 1, padding: "0 12px" }}>
          {currentCfg && (
            <div style={{ padding: "16px", borderRadius: 14, background: `${currentCfg.color}06`, border: `1px solid ${currentCfg.color}15`, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <CurrentIcon size={16} color={currentCfg.color} />
                <span style={{ fontSize: 13, fontWeight: 700, color: currentCfg.color }}>{currentCfg.label}</span>
              </div>
              <div style={{ fontSize: 11, color: subtle, lineHeight: 1.5 }}>
                {currentStatus === "pending" && "Your submission is under review. Admin will respond within 24-48 hours."}
                {currentStatus === "approved" && "Your Quora profile has been verified. Full access is now unlocked."}
                {currentStatus === "rejected" && "Your submission was not approved. See the rejection reason below."}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { label: "Submitted", done: initialStatus.hasSubmission || submitted },
              { label: "Under Review", done: currentStatus !== "none" },
              { label: "Decision", done: currentStatus === "approved" || currentStatus === "rejected" },
            ].map(({ label, done }, i) => (
              <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? `${BRAND}20` : "rgba(255,255,255,0.05)", border: `2px solid ${done ? BRAND : border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {done && <div style={{ width: 8, height: 8, borderRadius: "50%", background: BRAND }} />}
                  </div>
                  {i < 2 && <div style={{ width: 2, height: 24, background: done ? `${BRAND}30` : border, margin: "2px 0" }} />}
                </div>
                <div style={{ paddingTop: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: done ? textColor : subtle }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <UnlockIcon size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>Verification Status</div>
            <div style={{ fontSize: 12, color: subtle }}>Quora profile · account unlock</div>
          </div>
          {currentCfg && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: currentCfg.bg, border: `1px solid ${currentCfg.color}30`, fontSize: 11, fontWeight: 600, color: currentCfg.color }}>
              <CurrentIcon size={11} /> {currentCfg.label}
            </div>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "40px 64px" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* No submission yet — submission form */}
            {!initialStatus.hasSubmission && !submitted && (
              <div style={{ padding: "28px", borderRadius: 18, background: `${BRAND}06`, border: `1px solid ${BRAND}20` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: BRAND, marginBottom: 8 }}>Submit your Quora Profile</div>
                <div style={{ fontSize: 13, color: subtle, marginBottom: 20 }}>
                  Paste your Quora profile URL below. Format: <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>https://quora.com/profile/your-name</code>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://quora.com/profile/…"
                    style={{ flex: 1, padding: "10px 14px", background: bg, border: `1px solid ${border}`, borderRadius: 10, fontSize: 13, color: textColor, outline: "none" }}
                  />
                  <button onClick={handleSubmit} disabled={submitting || !newUrl.trim()} style={{ padding: "10px 18px", borderRadius: 10, background: BRAND, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: submitting || !newUrl.trim() ? 0.6 : 1 }}>
                    <ChevronRight size={13} /> Submit
                  </button>
                </div>
                {submitError && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 8 }}>{submitError}</div>}
              </div>
            )}

            {/* Status card (has submission) */}
            {(initialStatus.hasSubmission || submitted) && currentCfg && (
              <div style={{ padding: "28px", borderRadius: 18, background: currentCfg.bg, border: `1px solid ${currentCfg.color}25` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${currentCfg.color}15`, border: `1px solid ${currentCfg.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CurrentIcon size={24} color={currentCfg.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: currentCfg.color }}>{currentCfg.label}</div>
                    <div style={{ fontSize: 13, color: subtle }}>
                      {currentStatus === "pending" && "Submitted · Awaiting admin review"}
                      {currentStatus === "approved" && "Reviewed · Full access unlocked"}
                      {currentStatus === "rejected" && "Reviewed · See reason below"}
                    </div>
                  </div>
                </div>

                {currentStatus === "approved" && (
                  <div style={{ padding: "14px", borderRadius: 12, background: `${BRAND}08`, border: `1px solid ${BRAND}20`, marginBottom: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28 }}>🎉</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: BRAND, marginTop: 6 }}>Welcome to the Survivor Hub!</div>
                    <div style={{ fontSize: 13, color: subtle, marginTop: 4 }}>Your profile has been verified. All features are now unlocked.</div>
                    <a href="/" style={{ display: "inline-flex", marginTop: 12, padding: "10px 24px", borderRadius: 10, background: BRAND, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", alignItems: "center", gap: 6, textDecoration: "none" }}>
                      Continue to Hub <ChevronRight size={14} />
                    </a>
                  </div>
                )}

                {currentStatus === "rejected" && (
                  <div style={{ padding: "14px", borderRadius: 12, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", marginBottom: 4 }}>Rejection reason</div>
                    <div style={{ fontSize: 13, color: textColor, lineHeight: 1.5 }}>
                      The provided Quora profile URL could not be verified. Please submit a valid, publicly accessible Quora profile URL.
                    </div>
                  </div>
                )}

                {initialStatus.hasSubmission && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${border}` }}>
                    <ExternalLink size={13} color={subtle} />
                    <span style={{ fontSize: 12, color: subtle, flex: 1 }}>Quora profile submitted</span>
                  </div>
                )}
              </div>
            )}

            {/* Re-submit form (rejected state) */}
            {(currentStatus === "rejected") && !submitted && (
              <div style={{ padding: "20px", borderRadius: 14, background: surface, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: textColor, marginBottom: 12 }}>Re-submit with a new URL</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://quora.com/profile/…"
                    style={{ flex: 1, padding: "10px 14px", background: bg, border: `1px solid ${border}`, borderRadius: 10, fontSize: 13, color: textColor, outline: "none" }}
                  />
                  <button onClick={handleSubmit} disabled={submitting || !newUrl.trim()} style={{ padding: "10px 18px", borderRadius: 10, background: BRAND, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: submitting || !newUrl.trim() ? 0.6 : 1 }}>
                    <RefreshCw size={13} /> Re-submit
                  </button>
                </div>
                {submitError && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 8 }}>{submitError}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right rail */}
      <aside style={{ width: 280, borderLeft: `1px solid ${border}`, background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Why Quora?</div>
        <div style={{ padding: "14px", borderRadius: 12, background: `${BRAND}06`, border: `1px solid ${BRAND}18`, marginBottom: 16 }}>
          {[
            { icon: "🔗", t: "Real-person proof", d: "Quora activity proves you're a real person, not a bot." },
            { icon: "🛡", t: "Reduces infiltration risk", d: "Traffickers are less likely to have Quora history." },
            { icon: "🌐", t: "Publicly verifiable", d: "Admins can check your profile without contacting you directly." },
          ].map(({ icon, t, d }) => (
            <div key={t} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: textColor, marginBottom: 2 }}>{t}</div>
                <div style={{ fontSize: 11, color: subtle, lineHeight: 1.5 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>What you unlock</div>
        {["Full Directory access", "Skills Hunt participation", "Service Credits trading", "Plugin marketplace", "GDP contribution"].map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7, marginBottom: 4, fontSize: 12 }}>
            <CheckCircle size={12} color={currentStatus === "approved" ? BRAND : border} />
            <span style={{ color: currentStatus === "approved" ? textColor : subtle }}>{f}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}
