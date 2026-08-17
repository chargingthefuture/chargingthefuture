"use client";

import { type CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, MapPin, Pencil, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { getDirectoryTokens, initials, type DirectoryTokens, type Member } from "./shared";
import { DirectoryProfileEdit } from "./directory-profile-edit";
import { TrustWidgetCard } from "@/lib/shared/trust-interface";
import { BlockMemberButton } from "@/components/blocks/block-member-button";
import { WeaversBadgeControl } from "@/components/contributor-access/weavers-badge-control";
import { ShareLink } from "@/components/shared/share-link";
import type { TrustPeerView, TrustUserExtension } from "@/lib/shared/trust-interface";

// One cross-plugin presence entry returned by GET /api/presence/user/[userId].
interface PresenceEntry {
  pluginSlug: string;
  refType: string;
  refId: string;
  label: string;
  deepLink: string;
}

// The member's trust card and presence list are fetched client-side. Each fetch can be in one of a
// few states; the panels only render once they have something to show, and a restricted/private
// trust response renders a calm note rather than an error.
type TrustState =
  | { kind: "loading" }
  | { kind: "ready"; trust: TrustUserExtension | TrustPeerView }
  | { kind: "withheld" }
  | { kind: "hidden" };

// Shared uppercase section-label style, so every section reads identically.
function sectionLabelStyle(t: DirectoryTokens): CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: t.MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 };
}

// Trim a possibly-empty field to its value or null, so blank/whitespace fields render nothing.
function trimOrNull(value?: string | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

// "City, State, Country" from whichever parts are set (non-US members may have only a country).
function formatLocation(p: Member): string {
  return [p.city, p.state, p.country].map((v) => v?.trim()).filter(Boolean).join(", ");
}

// Presence and the trust panel only apply to a claimed profile. Both are client fetches that
// degrade quietly: a presence failure leaves the list empty (the section hides), and a trust
// failure hides the trust panel — neither can crash the profile.
//
// When the viewer owns this profile, both panels read the refreshing "self" routes
// (/api/presence/user/self and /api/trust/user/self), which recompute from the member's real
// cross-plugin activity on read — so your own profile reflects what you have actually done instead
// of a frozen index/snapshot that nothing refreshed. Viewing someone else's profile keeps the
// read-only by-id routes (you never trigger a recompute of another member's data).
function usePresenceAndTrust(claimedUserId: string | null, isOwnProfile: boolean) {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [trustState, setTrustState] = useState<TrustState>({ kind: "loading" });

  useEffect(() => {
    if (!claimedUserId) {
      setPresence([]);
      setTrustState({ kind: "hidden" });
      return;
    }

    const controller = new AbortController();

    async function loadPresence(userId: string) {
      try {
        const url = isOwnProfile
          ? `/api/presence/user/self`
          : `/api/presence/user/${encodeURIComponent(userId)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { presence?: PresenceEntry[] };
        if (!controller.signal.aborted) setPresence(data.presence ?? []);
      } catch {
        // Aborted or unavailable: leave presence empty so the section simply does not render.
      }
    }

    async function loadTrust(userId: string) {
      setTrustState({ kind: "loading" });
      try {
        const url = isOwnProfile
          ? `/api/trust/user/self`
          : `/api/trust/user/${encodeURIComponent(userId)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res.status === 403) {
          // Only a `private` profile refuses now: `restricted` returns 200 with the summary
          // projection, which renders as an ordinary (shorter) card. A calm state, not an error.
          setTrustState({ kind: "withheld" });
          return;
        }
        if (!res.ok) {
          setTrustState({ kind: "hidden" });
          return;
        }
        const trust = (await res.json()) as TrustUserExtension | TrustPeerView;
        setTrustState({ kind: "ready", trust });
      } catch {
        if (!controller.signal.aborted) setTrustState({ kind: "hidden" });
      }
    }

    void loadPresence(claimedUserId);
    void loadTrust(claimedUserId);

    return () => controller.abort();
  }, [claimedUserId, isOwnProfile]);

  return { presence, trustState };
}

// Header — matches the shell: a styled back button, not bare text.
function ProfileHeader({ tokens: t, onBack, profileId }: { tokens: DirectoryTokens; onBack: () => void; profileId: string }) {
  return (
    <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, background: t.HEADER, flexShrink: 0 }}>
      <button onClick={onBack} aria-label="Back to directory" title="Back to directory" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, cursor: "pointer", flexShrink: 0 }}>
        <ChevronLeft size={20} />
      </button>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Directory profile</div>
      {/* Share this profile — the one app-wide control (rule 130). The link opens the auth-gated
          deep-link page; a signed-in member lands on this profile, an unauthenticated visitor is
          redirected to the directory landing. */}
      <div style={{ marginLeft: "auto", color: t.ACCENT, fontSize: 13, fontWeight: 700 }}>
        <ShareLink url={`/apps/directory/profile/${profileId}`} title="Share this profile" />
      </div>
    </header>
  );
}

// Name row: the member's name, the (positive-only) Weavers badge, and the headline.
function IdentityNameRow({
  p,
  tokens: t,
  claimedUserId,
  headline,
  isCommunityGenerated,
}: {
  p: Member;
  tokens: DirectoryTokens;
  claimedUserId: string | null;
  headline: string | null;
  isCommunityGenerated: boolean;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 24, fontWeight: 800, color: t.TITLE, marginBottom: headline || isCommunityGenerated ? 4 : 8 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
        {/* "Weavers of the Commons" contributor badge — POSITIVE-ONLY: rendered when the
            claimed member holds it, and nothing at all renders for anyone else (no empty
            slot, no lock, no "not yet earned"). Clicking opens the honest explainer. */}
        {claimedUserId != null && p.hasWeaversBadge === true && (
          <WeaversBadgeControl size={20} tokens={t} />
        )}
      </div>
      {/* The headline (a short one-line tagline) always shows when set — including on a
          community-generated profile, where it used to be suppressed. */}
      {headline && <div style={{ fontSize: 15, color: t.SUBTLE, marginBottom: 8, lineHeight: 1.4 }}>{headline}</div>}
    </>
  );
}

// Community-generated origin block. "Community-generated profile" is only true until the person
// claims it, so hide that line publicly after a claim — the backend still records
// source === "community-generated". "Nominated by" stays accurate whether or not the profile has
// been claimed. Rendered only when there is at least one line to show.
function CommunityOriginBlock({
  p,
  tokens: t,
  claimedUserId,
  isCommunityGenerated,
}: {
  p: Member;
  tokens: DirectoryTokens;
  claimedUserId: string | null;
  isCommunityGenerated: boolean;
}) {
  if (!isCommunityGenerated) return null;
  const showClaimedLine = claimedUserId == null;
  const showNominator = Boolean(p.invitedByUsername);
  if (!showClaimedLine && !showNominator) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      {showClaimedLine && (
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT }}>Community-generated profile</div>
      )}
      {showNominator && (
        <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 2, lineHeight: 1.4 }}>Nominated by @{p.invitedByUsername}</div>
      )}
    </div>
  );
}

// Sector and job-title chips.
function IdentityBadges({ p, tokens: t }: { p: Member; tokens: DirectoryTokens }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {p.sector && <Badge style={{ background: `${t.ACCENT}15`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, fontSize: 12 }}>{p.sector}</Badge>}
      {p.jobTitle && <Badge style={{ background: "transparent", color: t.MUTED, border: `1px solid ${t.BORDER}`, fontSize: 12 }}>{p.jobTitle}</Badge>}
    </div>
  );
}

// Location — only the parts that are set, joined "City, State, Country".
function IdentityLocation({ tokens: t, locationText }: { tokens: DirectoryTokens; locationText: string }) {
  if (!locationText) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: t.SUBTLE, marginTop: 8 }}>
      <MapPin size={13} style={{ flexShrink: 0 }} />
      <span>{locationText}</span>
    </div>
  );
}

// Identity — avatar, name, badge, headline, origin block, chips, and location.
function ProfileIdentity({
  p,
  tokens: t,
  claimedUserId,
  headline,
  isCommunityGenerated,
  locationText,
}: {
  p: Member;
  tokens: DirectoryTokens;
  claimedUserId: string | null;
  headline: string | null;
  isCommunityGenerated: boolean;
  locationText: string;
}) {
  return (
    <div style={{ display: "flex", gap: 18, marginBottom: 24, alignItems: "center" }}>
      <Avatar style={{ width: 72, height: 72, flexShrink: 0 }}>
        <AvatarFallback style={{ background: `${t.ACCENT}30`, color: t.ACCENT, fontSize: 26, fontWeight: 800 }}>{initials(p.name)}</AvatarFallback>
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <IdentityNameRow p={p} tokens={t} claimedUserId={claimedUserId} headline={headline} isCommunityGenerated={isCommunityGenerated} />
        <CommunityOriginBlock p={p} tokens={t} claimedUserId={claimedUserId} isCommunityGenerated={isCommunityGenerated} />
        <IdentityBadges p={p} tokens={t} />
        <IdentityLocation tokens={t} locationText={locationText} />
      </div>
    </div>
  );
}

// Edit — only the profile owner sees this; it opens the edit form, which loads the full profile,
// lets the owner change any field, and saves through PUT /api/directory/profile.
function EditProfileButton({ tokens: t, isOwnProfile, onEdit }: { tokens: DirectoryTokens; isOwnProfile: boolean; onEdit: () => void }) {
  if (!isOwnProfile) return null;
  return (
    <button
      type="button"
      onClick={onEdit}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 24 }}
    >
      <Pencil size={15} />
      Edit my profile
    </button>
  );
}

// Quora profile — every directory profile is sourced from Quora, so this is the social proof and the
// way to learn more before bartering, trading, or exchanging credits. The card is a ShareLink
// trigger (the one app-wide link popup, rule 130): the popup shows the full URL with Copy link and
// Open in new tab, so nobody is sent off-app to Quora without seeing exactly where the link goes.
function QuoraProfileCard({ tokens: t, profileUrl }: { tokens: DirectoryTokens; profileUrl: string | null }) {
  if (profileUrl) {
    return (
      <div style={{ marginBottom: 24 }}>
        <ShareLink
          url={profileUrl}
          title="Their Quora profile (external site)"
          triggerStyle={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12,
            background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}35`, color: t.TEXT,
          }}
        >
          <ExternalLink size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ACCENT }}>View Quora profile</div>
            <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>
              Their Quora profile is the social proof — read more before you reach out.
            </div>
          </div>
        </ShareLink>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12,
        background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`,
        color: t.TEXT, marginBottom: 24, opacity: 0.6,
      }}
    >
      <ExternalLink size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.MUTED }}>Quora profile not linked yet</div>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>This profile has no Quora link on file.</div>
      </div>
    </div>
  );
}

// About — the free-text bio, when set.
function AboutSection({ tokens: t, bio }: { tokens: DirectoryTokens; bio: string | null }) {
  if (!bio) return null;
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={sectionLabelStyle(t)}>About</div>
      <p style={{ fontSize: 14, color: t.SUBTLE, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{bio}</p>
    </section>
  );
}

// Specializations. Real taxonomy skills render as accent chips. A profile may also have free-text
// skills not yet in the taxonomy — either nominated through SkillsHunt or added by the member
// through the "skill not listed" box on their own profile. Both render as muted "pending review"
// chips so the section is never empty just because a skill has not been promoted into the taxonomy
// yet.
function SpecializationsSection({ tokens: t, skills, pendingSkills }: { tokens: DirectoryTokens; skills: string[]; pendingSkills: string[] }) {
  const hasAny = skills.length > 0 || pendingSkills.length > 0;
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={sectionLabelStyle(t)}>Specializations</div>
      {hasAny ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {skills.map((s) => (
            <Badge key={s} style={{ background: `${t.ACCENT}15`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, fontSize: 13, padding: "5px 12px" }}>{s}</Badge>
          ))}
          {pendingSkills.map((s) => (
            <Badge
              key={`pending-${s}`}
              title="Not in the official skills list yet — pending admin review."
              style={{ background: "rgba(255,255,255,0.04)", color: t.MUTED, border: `1px dashed ${t.BORDER}`, fontSize: 13, padding: "5px 12px", fontWeight: 500 }}
            >
              {s} <span style={{ color: t.FAINT, fontWeight: 400 }}>· pending review</span>
            </Badge>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: t.FAINT }}>No skills listed yet.</div>
      )}
    </section>
  );
}

// How to connect — directory is read-only, so reaching out happens through the Quora profile and the
// rest of the app. This tells the viewer what they can do next.
function HowToConnectSection({ tokens: t }: { tokens: DirectoryTokens }) {
  return (
    <section style={{ padding: "16px 18px", borderRadius: 12, background: `${t.ACCENT}0A`, border: `1px solid ${t.ACCENT}25` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Sparkles size={14} style={{ color: t.ACCENT }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT }}>Want to work together?</div>
      </div>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.6 }}>
        The directory shows who is in the community and what they do. Want a service or good from
        this person? Look for them in{" "}
        <Link href="/apps/foundation" style={{ color: t.ACCENT, fontWeight: 600, textDecoration: "none" }}>Foundation</Link>,
        where members offer and exchange help — or browse{" "}
        <Link href="/apps/foundation" style={{ color: t.ACCENT, fontWeight: 600, textDecoration: "none" }}>Foundation</Link>{" "}
        to find someone else who can.
      </div>
    </section>
  );
}

// Block — only when viewing another member's claimed profile (never your own, never an unclaimed
// profile). Blocking is a baseline safety control: the button records a one-way block and is
// invisible to the person blocked. Enforcement across surfaces is wired separately (issue #809
// task 4); this is the create-entry-point so the flow is reachable.
function BlockSection({ claimedUserId, isOwnProfile, name }: { claimedUserId: string | null; isOwnProfile: boolean; name: string }) {
  if (!claimedUserId || isOwnProfile) return null;
  return (
    <section style={{ marginTop: 24, display: "flex", justifyContent: "flex-start" }}>
      <BlockMemberButton targetUserId={claimedUserId} displayName={name} />
    </section>
  );
}

// One cross-plugin presence row linking to where the member is also active.
function PresenceRow({ tokens: t, entry }: { tokens: DirectoryTokens; entry: PresenceEntry }) {
  return (
    <Link
      href={entry.deepLink}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
        background: `${t.ACCENT}0A`, border: `1px solid ${t.ACCENT}25`,
        textDecoration: "none", color: t.TEXT,
      }}
    >
      <ExternalLink size={15} style={{ color: t.ACCENT, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: t.SUBTLE }}>{entry.label}</span>
    </Link>
  );
}

// The trust card (or a calm restricted note) that sits beneath the presence list.
function TrustPanel({ tokens: t, trustState, isOwnProfile }: { tokens: DirectoryTokens; trustState: TrustState; isOwnProfile: boolean }) {
  if (trustState.kind === "ready") return <TrustWidgetCard trust={trustState.trust} isOwnCard={isOwnProfile} />;
  if (trustState.kind === "withheld") {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}` }}>
        <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.5 }}>
          This member limits who can view their trust.
        </div>
      </div>
    );
  }
  return null;
}

// Also active in + Trust — only for a claimed profile. Presence shows where else this member is
// active across plugins; the trust card sits beside it as peer social proof. Unclaimed profiles show
// neither (presence list is empty, trust is hidden).
function AlsoActiveInSection({
  tokens: t,
  claimedUserId,
  presence,
  trustState,
  isOwnProfile,
}: {
  tokens: DirectoryTokens;
  claimedUserId: string | null;
  presence: PresenceEntry[];
  trustState: TrustState;
  isOwnProfile: boolean;
}) {
  if (!claimedUserId) return null;
  const hasPresence = presence.length > 0;
  const trustHidden = trustState.kind === "hidden";
  if (!hasPresence && trustHidden) return null;
  const listBottomMargin = trustHidden ? 0 : 18;
  return (
    <section style={{ marginTop: 24 }}>
      <div style={sectionLabelStyle(t)}>Also active in</div>
      {hasPresence ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: listBottomMargin }}>
          {presence.map((entry) => (
            <PresenceRow key={`${entry.pluginSlug}:${entry.refType}:${entry.refId}`} tokens={t} entry={entry} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: t.FAINT, marginBottom: listBottomMargin }}>
          No activity in other plugins yet.
        </div>
      )}

      <TrustPanel tokens={t} trustState={trustState} isOwnProfile={isOwnProfile} />
    </section>
  );
}

// The Attach action buttons and their success/error feedback.
function AttachActions({
  tokens: t,
  attaching,
  attachDisabled,
  attachSuccess,
  attachError,
  currentUserId,
  onAttachClick,
  onUseMyAccount,
}: {
  tokens: DirectoryTokens;
  attaching: boolean;
  attachDisabled: boolean;
  attachSuccess: boolean;
  attachError: string | null;
  currentUserId?: string;
  onAttachClick: () => void;
  onUseMyAccount: () => void;
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={onAttachClick}
          disabled={attachDisabled}
          style={{ padding: "9px 18px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: attachDisabled ? "not-allowed" : "pointer", opacity: attachDisabled ? 0.5 : 1 }}
        >
          {attaching ? "Attaching…" : "Attach"}
        </button>
        {currentUserId && (
          <button
            type="button"
            onClick={onUseMyAccount}
            disabled={attaching}
            style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontWeight: 600, fontSize: 12, cursor: attaching ? "not-allowed" : "pointer" }}
          >
            Use my account
          </button>
        )}
      </div>
      {attachSuccess && <div style={{ marginTop: 10, fontSize: 12, color: t.ACCENT }}>Attached.</div>}
      {attachError && <div style={{ marginTop: 10, fontSize: 12, color: "#EF4444" }}>{attachError}</div>}
    </>
  );
}

// Attach-to-account admin panel — shown only to an admin viewing an unclaimed profile when an
// onAttach handler was supplied. Attaches the profile to a user account by their Clerk user ID.
function AttachToAccountPanel({
  tokens: t,
  profileId,
  isAdmin,
  claimedByUserId,
  currentUserId,
  onAttach,
}: {
  tokens: DirectoryTokens;
  profileId: string;
  isAdmin: boolean;
  claimedByUserId: string | null;
  currentUserId?: string;
  onAttach?: (profileId: string, targetUserId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [attachInput, setAttachInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSuccess, setAttachSuccess] = useState(false);

  const show = isAdmin && claimedByUserId == null && typeof onAttach === "function";
  const attachDisabled = attaching || attachInput.trim().length === 0;

  async function handleAttach() {
    const target = attachInput.trim();
    if (!target || !onAttach) return;
    setAttaching(true);
    setAttachError(null);
    setAttachSuccess(false);
    const result = await onAttach(profileId, target);
    if (result.ok) {
      setAttachSuccess(true);
    } else {
      setAttachError(result.error ?? "Could not attach this profile. Please try again.");
    }
    setAttaching(false);
  }

  if (!show) return null;

  return (
    <div style={{ marginTop: 24, padding: "20px", borderRadius: 16, background: `${t.ACCENT}0A`, border: `1px solid ${t.ACCENT}30` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Attach to account</div>
      <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginBottom: 12 }}>This profile is unclaimed. Attach it to a user account by their Clerk user ID.</div>
      <input
        value={attachInput}
        onChange={(e) => { setAttachInput(e.target.value); setAttachError(null); }}
        placeholder="Clerk user ID"
        disabled={attaching}
        style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${t.ACCENT}30`, borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
      />
      <AttachActions
        tokens={t}
        attaching={attaching}
        attachDisabled={attachDisabled}
        attachSuccess={attachSuccess}
        attachError={attachError}
        currentUserId={currentUserId}
        onAttachClick={handleAttach}
        onUseMyAccount={() => { setAttachInput(currentUserId ?? ""); setAttachError(null); }}
      />
    </div>
  );
}

export function DirectoryProfileDetail({
  member,
  onBack,
  isAdmin = false,
  currentUserId,
  onAttach,
  onProfileSaved,
}: {
  member: Member;
  onBack: () => void;
  isAdmin?: boolean;
  currentUserId?: string;
  onAttach?: (profileId: string, targetUserId: string) => Promise<{ ok: boolean; error?: string }>;
  // Called after the owner saves edits to their own profile, so the shell can re-fetch the list
  // and the detail view reflects the new values.
  onProfileSaved?: () => void;
}) {
  const p = member;
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  const claimedUserId = p.claimedByUserId;
  const [editing, setEditing] = useState(false);
  // The viewer owns this profile when their Clerk user id matches the profile's claimed owner.
  // Only the owner sees the Edit button; it binds the existing PUT /api/directory/profile upsert.
  const isOwnProfile = Boolean(currentUserId) && claimedUserId === currentUserId;

  const { presence, trustState } = usePresenceAndTrust(claimedUserId, isOwnProfile);

  const profileUrl = trimOrNull(p.profileUrl);
  const headline = trimOrNull(p.headline);
  const bio = trimOrNull(p.bio);
  const locationText = formatLocation(p);
  // A profile nominated through SkillsHunt is community-generated; show that and who
  // nominated it instead of a generic headline.
  const isCommunityGenerated = p.source === "community-generated";
  const pendingSkills = p.pendingSkills ?? [];

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex", flexDirection: "column" }}>
      <ProfileHeader tokens={t} onBack={onBack} profileId={p.id} />

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
          {/* Identity */}
          <ProfileIdentity
            p={p}
            tokens={t}
            claimedUserId={claimedUserId}
            headline={headline}
            isCommunityGenerated={isCommunityGenerated}
            locationText={locationText}
          />

          <EditProfileButton tokens={t} isOwnProfile={isOwnProfile} onEdit={() => setEditing(true)} />

          <QuoraProfileCard tokens={t} profileUrl={profileUrl} />

          {/* About */}
          <AboutSection tokens={t} bio={bio} />

          {/* Specializations */}
          <SpecializationsSection tokens={t} skills={p.skills} pendingSkills={pendingSkills} />

          {/* How to connect */}
          <HowToConnectSection tokens={t} />

          {/* Block */}
          <BlockSection claimedUserId={claimedUserId} isOwnProfile={isOwnProfile} name={p.name} />

          {/* Also active in + Trust */}
          <AlsoActiveInSection tokens={t} claimedUserId={claimedUserId} presence={presence} trustState={trustState} isOwnProfile={isOwnProfile} />

          <AttachToAccountPanel
            tokens={t}
            profileId={p.id}
            isAdmin={isAdmin}
            claimedByUserId={p.claimedByUserId}
            currentUserId={currentUserId}
            onAttach={onAttach}
          />
        </div>
      </div>

      {editing && (
        <DirectoryProfileEdit
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onProfileSaved?.();
          }}
        />
      )}
    </div>
  );
}
