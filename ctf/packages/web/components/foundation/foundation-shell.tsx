"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Hammer, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { AppLoading } from "@/components/shared/app-loading";
import { COLOR, FONT, type FoundationTab, type ProviderView, type QuoteView } from "./foundation-ui";
import { IconRail, FilterSidebar, RightRail } from "./foundation-rails";
import { BrowsePanel, QuotesPanel, ChatPanel } from "./foundation-panels";
import { ProviderProfile } from "./foundation-profile";

const CSRF_HEADERS = { "Content-Type": "application/json", "x-ctf-csrf": "1" };

function Centered({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color }}>
      {children}
    </div>
  );
}

export function FoundationShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [quotes, setQuotes] = useState<QuoteView[]>([]);
  const [tab, setTab] = useState<FoundationTab>("browse");
  const [trade, setTrade] = useState("All Trades");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProviderView | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const isMobile = useIsMobile();

  // Trade filter has no client-side field to match on; it scopes the server search query.
  const searchTerm = [trade === "All Trades" ? "" : trade, query].filter(Boolean).join(" ").trim();

  const loadQuotes = useCallback(async () => {
    const res = await fetch("/api/foundation/quotes/history");
    if (res.ok) {
      const data = (await res.json()) as { items?: QuoteView[] };
      setQuotes(data.items ?? []);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(searchTerm ? { q: searchTerm } : {});
        const [searchRes] = await Promise.all([
          fetch(`/api/foundation/providers/search?${params}`),
          loadQuotes(),
        ]);
        if (!active) return;
        if (searchRes.ok) {
          const data = (await searchRes.json()) as { items?: ProviderView[] };
          setProviders(data.items ?? []);
        }
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load Foundation.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [searchTerm, loadQuotes]);

  // Real quote creation is two steps: open a connection thread, then request a quote on it.
  const requestQuote = useCallback(async (provider: ProviderView) => {
    setSubmitting(true);
    setQuoteError(null);
    setQuoteSuccess(false);
    try {
      const threadRes = await fetch("/api/foundation/connections/threads", {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ providerId: provider.profileId }),
      });
      if (!threadRes.ok) throw new Error("Could not open a connection with this provider.");
      const threadData = (await threadRes.json()) as { thread?: { id?: string } };
      const threadId = threadData.thread?.id;
      if (!threadId) throw new Error("Connection response was incomplete.");

      const serviceType = provider.headline?.trim() || "General trade service";
      const quoteRes = await fetch("/api/foundation/quotes", {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ threadId, serviceType }),
      });
      if (!quoteRes.ok) throw new Error("Could not submit the quote request.");

      setQuoteSuccess(true);
      await loadQuotes();
      setSelected(null);
      setTab("quotes");
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : "Failed to request quote.");
    } finally {
      setSubmitting(false);
    }
  }, [loadQuotes]);

  if (loading) {
    return <AppLoading />;
  }

  if (error) {
    return <Centered color="#EF4444">{error}</Centered>;
  }

  if (selected) {
    return (
      <ProviderProfile
        provider={selected}
        submitting={submitting}
        quoteError={quoteError}
        quoteSuccess={quoteSuccess}
        onBack={() => { setSelected(null); setQuoteError(null); setQuoteSuccess(false); }}
        onRequestQuote={() => { void requestQuote(selected); }}
      />
    );
  }

  const content = (
    <>
      {tab === "browse" && <BrowsePanel providers={providers} onSelect={setSelected} />}
      {tab === "quotes" && <QuotesPanel quotes={quotes} onBrowse={() => setTab("browse")} />}
      {tab === "chat" && (
        <ChatPanel
          input={chatInput}
          onInput={setChatInput}
          onSend={() => setChatInput("")}
          onBrowse={() => setTab("browse")}
        />
      )}
    </>
  );

  if (isMobile) {
    const tabs: { key: FoundationTab; label: string }[] = [
      { key: "browse", label: "Browse" },
      { key: "quotes", label: "Quotes" },
      { key: "chat", label: "Chat" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: "#0F1117", fontFamily: FONT, color: "#E8EAF0" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0F14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}14`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Hammer size={18} style={{ color: COLOR, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", flex: 1 }}>Foundation</span>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${COLOR}1A` : "transparent", border: `1px solid ${tab === key ? COLOR + "40" : "rgba(255,255,255,0.08)"}`, color: tab === key ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {tab === "browse" && (
            <div style={{ padding: "0 12px 10px" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trade providers…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: FONT, color: "#E8EAF0", display: "flex" }}>
      <IconRail tab={tab} onTab={setTab} />
      <FilterSidebar query={query} onQuery={setQuery} trade={trade} onTrade={setTrade} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Hammer size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Foundation — Trade Services</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Vetted providers · Background-checked · Safe</div>
          </div>
        </header>
        {content}
      </div>
      <RightRail providers={providers} quoteCount={quotes.length} onBrowse={() => setTab("browse")} onSelect={setSelected} />
    </div>
  );
}
