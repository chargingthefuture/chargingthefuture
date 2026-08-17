"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MarkRecurringControl } from "@/components/shared/mark-recurring-control";
import { Badge } from "@/components/ui/badge";
import { Hammer, FileText, Wrench, MessageSquare, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { CurrencySelect } from "@/components/shared/currency-select";
import { SERVICE_CREDITS_CODE, SERVICE_CREDITS_LABEL } from "lib/currency/types";
import {
  getFoundationTokens, initials, quoteStatus, formatQuoteDate,
  type ProviderView, type QuoteView,
} from "./foundation-ui";
import { ConnectNowButton, InstantCallAvailabilityBadge, canOfferConnectNow, acceptsInstantCalls } from "./foundation-connect-now";

// Render a quoted price in its own currency. ServiceCredits always renders by its label (never a
// fiat symbol, never a fiat equivalent); every other currency shows the amount then the code.
function formatQuotedPrice(amount: number, currencyCode: string): string {
  if (currencyCode === SERVICE_CREDITS_CODE) {
    return `${amount} ${SERVICE_CREDITS_LABEL}`;
  }
  return `${amount} ${currencyCode}`;
}

// A quote amount is valid when it is a non-empty, finite, non-negative number and a currency is set.
// Kept out of the component body so the four checks don't count against its complexity budget.
function isQuoteAmountValid(amount: string, parsed: number, currency: string): boolean {
  return amount.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0 && currency.trim().length > 0;
}

// Provider-only inline form to respond to a 'requested' quote with a price. Holds its own amount and
// currency state; on submit it calls onRespond and clears the amount on success. The survivor never
// sees this — the parent only renders it when the viewer is the quote's provider.
function QuoteRespondForm({
  onRespond, accent, subtle, inputBg,
}: {
  onRespond: (amount: number, currency: string) => Promise<boolean>;
  accent: string;
  subtle: string;
  inputBg: string;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(SERVICE_CREDITS_CODE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const valid = isQuoteAmountValid(amount, parsed, currency);
  // The submit button is live only when the input is valid and no send is in flight.
  const ready = valid && !busy;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onRespond(parsed, currency);
    setBusy(false);
    if (ok) {
      setAmount("");
    } else {
      setError("Could not send the quote. Try again.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: subtle }}>Respond with a price</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Quoted amount"
          placeholder="Amount"
          style={{ flex: "1 1 100px", minWidth: 90, padding: "8px 10px", borderRadius: 8, background: inputBg, border: `1px solid ${accent}30`, color: "inherit", fontSize: 13 }}
        />
        <CurrencySelect
          value={currency}
          onChange={(code) => setCurrency(code)}
          ariaLabel="Quoted currency"
          className="foundation-quote-currency"
        />
        <button
          onClick={() => void submit()}
          disabled={!ready}
          style={{ padding: "8px 14px", borderRadius: 8, background: accent, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: ready ? "pointer" : "not-allowed", opacity: ready ? 1 : 0.6, flexShrink: 0 }}
        >
          {busy ? "Sending…" : "Send quote"}
        </button>
      </div>
      {error ? <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div> : null}
    </div>
  );
}

const EMPTY_STEPS = [
  "Request an electrician, plumber, or other trade",
  "Get quotes from community providers",
  "Accept a quote and pay with ServiceCredits",
];

// How many skills a provider's browse card shows before collapsing the rest behind
// a "+N more" chip (the full list is on the profile). Keeps a many-skill provider
// from dominating the list on mobile.
const SKILL_PREVIEW_CAP = 6;

// Prefer the name passed from the shell (the chip the member tapped) so the banner label survives
// even when the filter returns zero providers; fall back to whichever card still shows it. Kept out
// of the component body so its nullish/optional chains don't count against BrowsePanel's complexity.
function resolveBannerSkillName(
  activeSkillName: string | null,
  activeSkillId: string | null,
  providers: ProviderView[],
): string | null {
  if (activeSkillName) return activeSkillName;
  if (!activeSkillId) return null;
  return providers.flatMap((p) => p.offeredSkills).find((s) => s.id === activeSkillId)?.name ?? null;
}

export function BrowsePanel({
  providers, viewerUserId = null, onSelect, activeSkillId = null, activeSkillName = null, searchActive = false, onSkillFilter,
}: {
  providers: ProviderView[];
  viewerUserId?: string | null;
  onSelect: (p: ProviderView) => void;
  activeSkillId?: string | null;
  activeSkillName?: string | null;
  // Whether a trade/search-text filter is narrowing the list. Drives the empty state: with no filter
  // at all, "no providers offering this / clear the filter" is nonsense — there is simply nobody yet.
  searchActive?: boolean;
  onSkillFilter?: (skillId: string | null, skillName?: string | null) => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const bannerSkillName = resolveBannerSkillName(activeSkillName, activeSkillId, providers);

  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(239,68,68,0.05) 100%)`, border: `1px solid ${t.ACCENT}20` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Find providers offering a skill</div>
          <div style={{ fontSize: 14, color: t.SUBTLE }}>Everyone here has opted in to be contacted — tap a skill to filter.</div>
        </div>
        {activeSkillId ? (
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}30` }}>
            <span style={{ fontSize: 13, color: t.TITLE }}>Offering: <strong style={{ color: t.ACCENT }}>{bannerSkillName ?? "selected skill"}</strong></span>
            <button onClick={() => onSkillFilter?.(null)} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 7, background: "transparent", border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear</button>
          </div>
        ) : null}
        {providers.length === 0 ? (
          (() => {
            // The empty state depends on why the list is empty. A skill filter or a search narrows the
            // list, so pointing the member at clearing it is right. But with no filter at all there is
            // nothing to clear — the list is empty because nobody has offered a skill here yet, and
            // telling the member to "clear the skill filter" makes no sense.
            const filtered = Boolean(activeSkillId) || searchActive;
            const title = filtered ? "No providers match" : "No providers offering skills yet";
            const hint = activeSkillId
              ? "Try a different skill, or clear the filter to see everyone."
              : searchActive
                ? "Try a different search."
                : "Everyone here opts in before they show up. Check back soon as members offer skills.";
            return (
              <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Hammer size={20} style={{ color: "rgba(239,68,68,0.4)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.SUBTLE }}>{title}</div>
                <div style={{ fontSize: 13, color: t.FAINT }}>{hint}</div>
              </div>
            );
          })()
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {providers.map((p) => {
              // Cap the skills shown on the card so a provider with many skills doesn't
              // dominate the list — the full set lives on the profile. Keep the actively
              // filtered skill first (it's why this provider matched), and always show a
              // "+N more" affordance when some are hidden, so a member who searched for a
              // skill they don't see here knows there are more behind View Profile.
              const orderedSkills = activeSkillId
                ? [...p.offeredSkills].sort((a, b) =>
                    a.id === activeSkillId ? -1 : b.id === activeSkillId ? 1 : 0,
                  )
                : p.offeredSkills;
              const visibleSkills = orderedSkills.slice(0, SKILL_PREVIEW_CAP);
              const hiddenSkillCount = orderedSkills.length - visibleSkills.length;
              return (
                <div key={p.profileId} role="button" tabIndex={0} onClick={() => onSelect(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p); } }} style={{ width: "100%", textAlign: "left", padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}18`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Header row: identity on the left, primary action (View Profile) on the right. */}
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <Avatar style={{ width: 52, height: 52, flexShrink: 0 }}>
                      <AvatarFallback style={{ background: `${t.ACCENT}20`, color: t.ACCENT, fontSize: 18, fontWeight: 800 }}>{initials(p.displayName)}</AvatarFallback>
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>{p.displayName}</div>
                      {p.headline && <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6 }}>{p.headline}</div>}
                      {p.bio && <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.bio}</div>}
                    </div>
                    <span style={{ padding: "7px 16px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      View Profile
                    </span>
                  </div>

                  {/* Provider's own short blurb — their plain "here's what I offer" line, shown
                      before the skills and the CTA so a member can size up the listing at a glance. */}
                  {p.shortDescription ? (
                    <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.5 }}>{p.shortDescription}</div>
                  ) : null}

                  {/* Skills use the full card width and wrap into a compact cloud, capped
                      with a "+N more" chip that opens the full profile. */}
                  {p.offeredSkills.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {visibleSkills.map((s) => {
                        const active = s.id === activeSkillId;
                        return (
                          <span
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onSkillFilter?.(active ? null : s.id, active ? null : s.name); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSkillFilter?.(active ? null : s.id, active ? null : s.name); } }}
                            style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: active ? t.ACCENT : `${t.ACCENT}12`, color: active ? "#1a1205" : t.ACCENT, border: `1px solid ${active ? t.ACCENT : t.ACCENT + "30"}` }}
                          >
                            {s.name}
                          </span>
                        );
                      })}
                      {hiddenSkillCount > 0 ? (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`View ${hiddenSkillCount} more ${hiddenSkillCount === 1 ? "skill" : "skills"} on ${p.displayName}'s profile`}
                          onClick={(e) => { e.stopPropagation(); onSelect(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect(p); } }}
                          style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: t.INPUT_BG, color: t.SUBTLE, border: "1px solid rgba(255,255,255,0.14)" }}
                        >
                          +{hiddenSkillCount} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* 1:1 call availability — one of the key signals for a member deciding who to reach. */}
                  {canOfferConnectNow(p, viewerUserId) ? (
                    <ConnectNowButton provider={p} compact />
                  ) : acceptsInstantCalls(p) ? (
                    <InstantCallAvailabilityBadge provider={p} compact />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// The quoted price on a responded or closed quote, with a settled marker once close stamps it. Nothing
// to show while the provider has not attached a price.
function QuotedPriceRow({ quote: q, title }: { quote: QuoteView; title: string }) {
  if (q.quotedAmount === null || !q.quotedCurrency) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingLeft: 54 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: title }}>
        Quoted {formatQuotedPrice(q.quotedAmount, q.quotedCurrency)}
      </span>
      {q.settledAtIso ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#22C55E" }}>
          <CheckCircle2 size={14} /> Settled
        </span>
      ) : null}
    </div>
  );
}

// One quote row. Lifted out of the list's map callback so each stays a single readable unit: the row
// decides four things (its status chip, whether the viewer is the provider, whether a price is shown,
// and which of the two forms belongs underneath), which is more than a callback should carry.
function QuoteCard({
  quote: q,
  viewerUserId,
  onOpenDirectLine,
  onRespond,
}: {
  quote: QuoteView;
  viewerUserId?: string | null;
  onOpenDirectLine: (quote: QuoteView) => void;
  onRespond?: (quote: QuoteView, quotedAmount: number, quotedCurrency: string) => Promise<boolean>;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const status = quoteStatus(q.lifecycleState);
  const isProvider = Boolean(viewerUserId) && q.providerUserId === viewerUserId;
  // The provider may attach a price only while the quote is still 'requested'.
  const canRespond = isProvider && q.lifecycleState === "requested" && Boolean(onRespond);
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}20`, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={18} style={{ color: t.ACCENT }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>{q.serviceType}</div>
          <div style={{ fontSize: 12, color: t.MUTED }}>Requested {formatQuoteDate(q.createdAtIso)}</div>
        </div>
        <Badge style={{ background: status.bg, color: status.fg, border: `1px solid ${status.bd}`, fontSize: 11 }}>{status.label}</Badge>
        <button
          onClick={() => onOpenDirectLine(q)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          <MessageSquare size={14} /> Direct Line
        </button>
      </div>

      <QuotedPriceRow quote={q} title={t.TITLE} />

      {/* A closed engagement is often the start of a standing arrangement — the same electrician every
          quarter. Offered to the survivor side (the side that would keep calling the same provider)
          right on the quote, as well as on the thread itself, so nobody has to go to another app to
          record it. Foundation settles each metered call on its own, so a declared ServiceCredits value
          here is recognized as a relationship rather than counted a second time — see
          PER_OCCURRENCE_ORIGIN_PLUGINS. */}
      {!isProvider && q.lifecycleState === "closed" ? (
        <div style={{ paddingLeft: 54 }}>
          <MarkRecurringControl
            counterpartyUserId={q.providerUserId}
            originPlugin="foundation"
            sector="service"
            sectorLabel={`ongoing ${q.serviceType} work`}
            accent={t.ACCENT}
          />
        </div>
      ) : null}

      {/* Provider-only price-response form while the quote is still awaiting a response. */}
      {canRespond && onRespond ? (
        <div style={{ paddingLeft: 54 }}>
          <QuoteRespondForm
            onRespond={(amount, currency) => onRespond(q, amount, currency)}
            accent={t.ACCENT}
            subtle={t.SUBTLE}
            inputBg={t.INPUT_BG}
          />
        </div>
      ) : null}
    </div>
  );
}

export function QuotesPanel({
  quotes, viewerUserId = null, onBrowse, onOpenDirectLine, onRespond,
}: {
  quotes: QuoteView[];
  // The signed-in member's id, so the price-response form is shown only to the quote's provider.
  viewerUserId?: string | null;
  onBrowse: () => void;
  onOpenDirectLine: (quote: QuoteView) => void;
  // Provider responds to a 'requested' quote with a price; returns whether the POST succeeded.
  onRespond?: (quote: QuoteView, quotedAmount: number, quotedCurrency: string) => Promise<boolean>;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>My Quote Requests</div>
        <div style={{ fontSize: 14, color: t.MUTED, marginBottom: 20 }}>Track your service requests and responses</div>
        {quotes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={28} style={{ color: t.ACCENT, opacity: 0.5 }} />
            </div>
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.TITLE, marginBottom: 8 }}>No quote requests yet</div>
              <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7 }}>When you request quotes from trade providers, they&apos;ll appear here so you can track status and manage your service history in one place.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 400 }}>
              {EMPTY_STEPS.map((step, i) => (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(239,68,68,0.15)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: t.ACCENT }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: t.MUTED }}>{step}</span>
                </div>
              ))}
            </div>
            <button onClick={onBrowse} style={{ padding: "12px 24px", borderRadius: 12, background: t.ACCENT, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Wrench size={16} /> Request a Trade Service
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {quotes.map((q) => (
              <QuoteCard
                key={q.id}
                quote={q}
                viewerUserId={viewerUserId}
                onOpenDirectLine={onOpenDirectLine}
                onRespond={onRespond}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
