# Design Audit — 2026-05-29

Scope: full sweep of all 174 mockups in the `design/` submodule (`survivor-hub` + `landing`), pinned at design commit `98058a5`.
Method: multi-agent audit (one reader per batch of 8 files) + synthesis, plus a follow-up pass for one batch that failed structured output. Checks: currency/fiat pegging, banned "phase" words, brand-voice / trauma-informed tone, copy quality, `// design-sync` marker contract, loading-message consistency, and 4-state completeness.
Model: the app produces this list; all fixes are applied by the Replit design agent in the design repo (one-way design->app contract, see `.claude/rules/128-design-sync-workflow-rules.mdc`). The app never edits files under `design/`.

Totals (synthesis pass, 166/174 files): 191 raw findings · 11 components with state gaps · 4 files missing the marker. Plus the 8-file addendum below.

> Coverage note: one batch (8 files: `MobileTrustTransportLoading`, `MobileTrustTransportPublic`, the four `MobileUnlock` states, `MobileWeeklyPerformance`, `MobileWeeklyPerformanceEmpty`) failed to return structured output in the main run and was audited separately — see "Addendum" at the end. All 174 files are now covered.

---

## ⚠️ Correction & owner rulings (2026-05-29, post-review) — read before using the list

The first-pass "currency" findings below were over-broad. Owner rulings reclassify them:

- GDP is currency-agnostic and aggregates *all* transactions (ServiceCredits, fiat, barter). GDP
  `$` figures (`$247B`, `$300B`, GDP Delta `$1.2M`, sector `$B`, country `$B`) are legitimate and
  not must-fix. They are deferred to the multi-currency field work (issue #120) and the design
  pass that follows — do not strip them.
- Fiat prices/rates are legitimate data. Foundation `$/hr` rates and LightHouse `$/mo` rents are
  real prices. A fiat price shown *next to* an "Accepts ServiceCredits" badge is correct in a
  compact view — two separate fields. Not must-fix; handled by issue #120 (modeling currency +
  accepted-currencies as fields) and the subsequent design pass.
- The only true must-fix currency items peg ServiceCredits to fiat / claim monetary parity:
  - `ServiceCredits.tsx:168` — "≈ $242 USD purchasing power"
  - `ServiceCredits.tsx:134` — "No purchasing power yet"
  - `ServiceCreditsPublic.tsx:41` — "real monetary value"
  - `MobileServiceCredits.tsx:64` — "credits ≈ $242 USD"
  - `MobileServiceCreditsPublic.tsx:22` — "real monetary value"

  Reword these to ServiceCredits utility framing (no fiat equivalent). This is the legal line.

Still must-fix as written: all "Phase" words; brand-voice / trauma items; naming — the
token is `ServiceCredits` (one word, PascalCase), not "ServiceCredits"/"SC"/"cr"/"credits";
user-facing two-word app names join PascalCase, internal names stay spaced (e.g. "Weekly
Performance"); the `// design-sync` marker gaps; and the 4-state gaps.

Resolved open questions (do not re-ask the owner):
1. *Non-fiat scale:* GDP keeps real figures; only ServiceCredits must never show a fiat equivalent.
2. *ServiceCredits value display:* show credit quantity + utility ("usable across the 18 plugins"); never a fiat figure.
3. *External rent/rates:* allowed; real prices in their own currency field (#120), beside a separate "Accepts ServiceCredits" badge.
4. *"GDP" term:* kept — accurate currency-agnostic aggregate, not fiat misuse.
5. *Loading screen:* slogan stays; must be calm, no flashing, ADA-compliant, trauma-informed; just normalize all loaders to one consistent rendering (no literal slash — two stacked lines).
6. *Counts:* mockup counts are dummy — canonical 18 plugins, 62 users today, goal 5M.
7. *"No certainty needed" nomination copy:* intended — owner specs cover it; no change.

Everything below is the raw first-pass report; apply it through the lens of this correction.

---

## Summary

This audit covers the `survivor-hub` and `landing` mockups in the `design/` submodule. It found 172 findings plus structural gaps across loading states, 4-state completeness, and the design-sync manifest contract.

Findings by severity:
- must-fix: 96
- should-fix: 33
- question: 27

Findings by category:
- currency (fiat/USD pegging): 81
- phase (banned phase words): 28
- copy (naming, attribution, deprecated data, unused imports): 38
- brandvoice (trauma-informed tone): 12
- marker (missing design-sync line-1 marker): 4

Headline: The dominant problems are systemic, not one-off. Nearly every economy/GDP surface — web and mobile — denominates the ServiceCredits economy in US dollars (`$247B`, `$300B`, `$/hr` rates, `$/mo` rents, member contributions in `$`, and explicit "real monetary value" / "purchasing power" / "≈ $242 USD" pegs). This directly violates the non-fiat, Psyop-Free credit-economy rule and is the single largest fix cluster. The second cluster is banned "Phase 0/1/2/3" labels appearing in badges, tags, nav filters, announcements, and a trending hashtag across ~20 files. A third, softer cluster is trauma-informed tone: "stop needing/depending on traffickers", "reduces infiltration", "gamified talent scouting", growth-hype, and the activist loading slogan. Structurally, all four `landing/` files are missing the `// design-sync` marker, several components lack one or more of the four required states, and loading copy is nearly uniform but split between two punctuation variants. ClickLog itself is clean on content (loading-slogan only).

## List for Replit (design repo)

All fixes below are applied by the Replit design agent in the `design/` repo. The app does not edit these files. Within each family, must-fix currency/phase/brandvoice items are listed first.

### Desktop / Hub (web)
- `Desktop.tsx:16` (must-fix, phase) — `MINI_APPS` `tag: "Phase 0/1/2"` (lines 16–30) — replace phase tags with a non-phase availability concept (`Live`, `Coming soon`) or drop the tag.
- `Desktop.tsx:34` (must-fix, currency) — "TI Skills Economy is at $247B of its $300B opportunity" — reframe in ServiceCredits / member-activity terms; no USD.
- `Desktop.tsx:38` (must-fix, currency) — stat `$247B` / `of $300B opportunity` — replace with a non-fiat metric.
- `Desktop.tsx:180` (must-fix, currency) — hero "$300B opportunity" — express without a dollar figure.
- `Desktop.tsx:183` (must-fix, currency) — `$247B` GDP tile — non-fiat figure.
- `Desktop.tsx:363` (must-fix, currency) — GDP Progress widget `$247B` / `of $300B` / `$53B remaining` (lines 363, 364, 370) — credit- or percentage-denominated progress.
- `Desktop.tsx:340` (question, copy) — Carl Jung quote is widely misattributed — correct attribution or use unattributed trauma-informed copy.
- `MobileHome.tsx:106` (must-fix, currency) — `$247B` GDP stat — non-fiat (e.g. `247B SC`).
- `MobileHomeEmpty.tsx:76` (must-fix, currency) — `$247B` GDP stat — non-fiat.
- `MobileHome.tsx:201` (should-fix, copy) — "coming soon" placeholder tabs — replace with finished empty-state copy or confirm scaffolding.
- `MobileHome.tsx:5` / `MobileGentlePulse.tsx:3` (question, copy) — unused `Badge` import — remove.

### Hub public/empty
- `HubPublic.tsx:22` (must-fix, currency) — "GDP dashboard just hit $247B" — express scale in ServiceCredits.
- `HubPublic.tsx:28` (must-fix, currency) — `GDP Economy` `$247B` with `DollarSign` icon — re-express in SC and swap to `Coins` icon.
- `HubPublic.tsx:57` (must-fix, currency) — banner "$247B economy" — SC or omit.
- `HubEmpty.tsx:19` (must-fix, currency) — "$300B opportunity" onboarding card — participation terms.
- `HubEmpty.tsx:90` (must-fix, currency) — hero "$300B opportunity" — reframe.
- `HubEmpty.tsx:143` (must-fix, currency) — `$0` contribution — use `0 SC`.
- `HubEmpty.tsx:150` (must-fix, currency) — `Global: $247B` — ServiceCredits.
- `HubEmpty.tsx:159` (should-fix, currency) — "ServiceCredits economy" bullet is correct; remove the conflicting `$` figures on the same screen (19, 90, 143, 150).
- `HubEmpty.tsx:134` (question, copy) — "Member since 2024" (today is 2026) — confirm sample vs deprecated placeholder.
- `MobileHubPublic.tsx:24` (must-fix, currency) — `GDP` `$247B` — non-fiat.
- `MobileHubPublic.tsx:117` (should-fix, currency) — bottom-nav label `GDP` — rename to `Economy`/`Credits`.

### GDP family (web)
- `GDP.tsx:32` (must-fix, currency) — "building a $300B economy" — SC / non-fiat index.
- `GDP.tsx:34` (must-fix, currency) — "valued at $247.1 billion — 82% of the $300B opportunity" — SC totals.
- `GDP.tsx:80` (must-fix, currency) — ticker `$247.1B` / `+$1.2B this week` — SC.
- `GDP.tsx:84` (must-fix, currency) — Target `$300B` — SC.
- `GDP.tsx:95` (must-fix, currency) — header "4.9M survivors building $300B" + hero "$247.1B of $300 Billion" — non-fiat.
- `GDP.tsx:129` (must-fix, currency) — "GDP by Sector ($B)" + `${s.value}B` — SC; drop `$B`.
- `GDP.tsx:153` (must-fix, currency) — Top 5 Countries `${c.gdp}B` — SC.
- `GDP.tsx:216` (must-fix, currency) — "estimated contribution: $24,800" — SC.
- `GDP.tsx:223` (must-fix, currency) — "trip completed — $18 added to GDP" — SC.
- `GDP.tsx:231` (must-fix, currency) — "$300B Target Timeline … $247.1B / $300B" — SC.
- `GDP.tsx:73` (must-fix, phase) — "By Phase" filter — replace with `By Timeline` or remove.
- `GDP.tsx:221` (should-fix, currency) — "earned 500 credits" is correct; apply this pattern to the `$`-denominated feed items.
- `GDPEmpty.tsx:30` (must-fix, phase) — `Phase 2` badge — remove / availability label.
- `GDPEmpty.tsx:37` (should-fix, copy) — empty state has no fiat peg (good); ensure populated value uses SC.
- `GDPPublic.tsx:26` (must-fix, currency) — `TOP_COUNTRIES` `$89.4B`…`$18.9B` — SC.
- `GDPPublic.tsx:70` (must-fix, currency) — hero `$247B` / `of $300B opportunity` — SC.
- `GDPPublic.tsx:129` (must-fix, currency) — sector `${value}B` — strip `$` and `B`; render SC.
- `GDPPublic.tsx:160` (must-fix, currency) — CTA earns "ServiceCredits" but dashboard shows `$B`; decouple — remove all dollar figures.
- `GDPPublic.tsx:3` (should-fix, currency) — unused `DollarSign` import — remove.
- `GDPPublic.tsx:143` (question, copy) — "Top Countries by Economic Output" — confirm unit reads as credit output not USD.
- `GDPPublicAlt.tsx:3` (should-fix, currency) — unused `DollarSign` import — remove.
- `GDPPublicAlt.tsx:26` (must-fix, currency) — `TOP_COUNTRIES` `$B` figures — SC.
- `GDPPublicAlt.tsx:114` (must-fix, currency) — hero `$247B` / `$300B` — SC.
- `GDPPublicAlt.tsx:173` (must-fix, currency) — sector `${value}B` — strip `$`/`B`; SC.
- `GDPPublicAlt.tsx:204` (must-fix, currency) — same CTA/dashboard peg as GDPPublic:160 — remove dollar figures.

### GDP family (mobile)
- `MobileGDP.tsx:58` (must-fix, currency) — `$247.1B` total — SC.
- `MobileGDP.tsx:59` (must-fix, currency) — "of $300B target · 82.4% reached" — SC goal.
- `MobileGDP.tsx:65` (must-fix, currency) — `+$1.2B` this week — SC.
- `MobileGDP.tsx:81` (must-fix, currency) — `${c.gdp}B` per country — SC.
- `MobileGDP.tsx:93` (must-fix, currency) — "Your contribution to GDP: $24,800" — SC.
- `MobileGDP.tsx:104` (must-fix, currency) — `${s.value}B` sector — SC.
- `MobileGDP.tsx:120` (must-fix, currency) — `${v}B` trend axis labels — SC.
- `MobileGDP.tsx:128` (must-fix, currency) — "$300B Target Timeline" — SC.
- `MobileGDP.tsx:140` (must-fix, currency) — "Building a $300B survivor economy" tagline — SC.
- `MobileGDP.tsx:45` (should-fix, copy) — "GDP Tracker" (populated) vs "GDP Dashboard" (empty) — pick one canonical name; reconsider GDP/dollar framing.
- `MobileGDPEmpty.tsx:26` (must-fix, currency) — `$247B` total — SC.
- `MobileGDPEmpty.tsx:32` (must-fix, currency) — "Your contribution: $0" — `0 ServiceCredits`.
- `MobileGDPPublic.tsx:28` (must-fix, currency) — `$2.4B` headline — `2.4B SC`, drop `$`.
- `MobileGDPPublic.tsx:29` (should-fix, currency) — "annual ServiceCredits exchanged" label sits under `$2.4B`; once `$` dropped, ensure unit reads ServiceCredits.

### Foundation / tradespeople (web + mobile)
- `Foundation.tsx:739` (must-fix, phase) — "Phase 1" subtitle — drop.
- `Foundation.tsx:44` (must-fix, currency) — `$85/hr` etc. provider rates — ServiceCredits/hr.
- `Foundation.tsx:122` (must-fix, currency) — QUOTES `$340` / `$190` — SC.
- `Foundation.tsx:956` (must-fix, currency) — "Accept a quote and pay with ServiceCredits" paired with `$` quotes — keep SC language, remove surrounding fiat prices.
- `Foundation.tsx:23` (question, copy) — unused `DollarSign`, `Zap` imports — remove.
- `FoundationPublic.tsx:8` (must-fix, currency) — `$/hr` preview prices next to "Credits OK" — SC or remove price chip.
- `FoundationPublic.tsx:38` (must-fix, currency) — "Pay with ServiceCredits or cash" — remove "or cash"; SC only.
- `FoundationPublic.tsx:3` (question, copy) — unused `DollarSign` import — remove.
- `MobileFoundation.tsx:11–13` (must-fix, currency) — `$85/95/110/hr` for credits-accepting providers — SC rates.
- `MobileFoundation.tsx:57` (must-fix, currency) — Rate stat tile shows `$/hr` — SC.
- `MobileFoundation.tsx:116` (must-fix, currency) — list-card `$/hr` — SC.
- `MobileFoundation.tsx:86` (question, copy) — "8,400 vetted tradespeople" + "Background-checked" claims — verify counts/claims.
- `MobileFoundationPublic.tsx:26–29` (must-fix, currency) — `$85/95/90/75/hr` while page says "Pay with ServiceCredits" — SC rates.
- `MobileFoundationPublic.tsx:40` (must-fix, currency) — rendered `$/hr` element — SC.
- `MobileFoundationEmpty.tsx:33` (must-fix, currency) — "Paid in ServiceCredits or cash — your choice" — remove cash option.

### LightHouse / housing (web + mobile)
- `LightHouse.tsx:143` (must-fix, phase) — "Phase 2" subtitle — drop.
- `LightHouseEmpty.tsx:42` (must-fix, phase) — `Phase 2` sidebar badge — remove.
- `LightHousePublic.tsx:8–11` (must-fix, currency) — `price: 850/1100/1400/650` with `credits: true` — denominate listings in ServiceCredits, not USD.
- `LightHousePublic.tsx:62` (must-fix, currency) — renders `${l.price}/mo` — `N credits / mo`, no `$`.
- `LightHousePublic.tsx:76` (should-fix, copy) — "Filter by price…" implies fiat — reword to "Filter by Service Credit cost…".
- `MobileLightHousePublic.tsx:27–29` (must-fix, currency) — `$850/$1,100/$650/mo` with `credits: true` — ServiceCredits.
- `MobileLightHousePublic.tsx:36` (must-fix, currency) — renders the dollar price strings; "Credits OK" (line 37) must not sit beside a USD price — convert.
- `LightHouse.tsx:26, 83, 226` (question, currency) — external-rent USD figures shown beside "Accepts ServiceCredits" / "Pricing Guide" ranges — owner decision on whether real-world fiat rent may be shown (see Open Questions).
- `MobileLightHouse.tsx:58, 113` (question, currency) — `${l.price}/mo` listing detail/card + separate "Accepts ServiceCredits" badge — same owner decision.

### Workforce / SkillsHunt / PeerProgramming
- `Workforce.tsx:100` (must-fix, phase) — "Phase 1" subheader — drop.
- `Workforce.tsx:102` (must-fix, phase) — `Phase 1` badge — remove.
- `Workforce.tsx:243` (must-fix, phase) — "Skills: 7 verified · Phase 1" — drop phase.
- `Workforce.tsx:80` (must-fix, phase) — "By Phase" nav filter — rename to `By Status` (avoid "Stage" if it reads as a phase synonym; confirm with owner).
- `Workforce.tsx:38`-adjacent (`MobileWorkforce.tsx:38`) (question, copy) — confirm 4.9M survivor count consistency.
- `MobileWorkforce.tsx:41` (must-fix, phase) — `Phase 1` badge — remove.
- `WorkforcePublic.tsx:37` (question, copy) — "4.9M survivors tracked" — "tracked" is surveillance-adjacent; use "supported"/"in the network"; reconcile with LandingHero "5M+".
- `WorkforcePublic.tsx:44` (should-fix, copy) — same "tracked"/scale concern; supportive phrasing.
- `MobilePeerProgramming.tsx:40` (must-fix, phase) — `Phase 2` badge — remove.
- `PeerProgrammingEmpty.tsx:36` (must-fix, phase) — `Phase 1` label — remove.
- `MobilePeerProgramming.tsx:108` (question, copy) — "Jobs Landed 1,284" and other global stats — confirm approved vs placeholder.
- `SkillsHunt.tsx:257` (should-fix, brandvoice) — "trafficker infiltration" lines (also 365, 30, 39, 63, 113) — soften to safety-framed phrasing.
- `SkillsHuntEmpty.tsx:30` (should-fix, copy) — "stop depending on traffickers for basic needs" — reframe to self-sufficiency.
- `SkillsHuntPublic.tsx:63` (should-fix, copy) — "We stop needing traffickers" — positive self-sufficiency reframe.
- `MobileSkillsHuntEmpty.tsx:31` (should-fix, brandvoice) — "so we stop needing traffickers" — survivor-agency reframe.
- `MobileSkillsHuntEmpty.tsx:39` (should-fix, copy) — "reduces infiltration" — softer phrasing.
- `MobileSkillsHuntPublic.tsx:30` (question/should-fix, brandvoice/copy) — "stop depending on traffickers" + nominating third parties as possible survivors without consent — owner confirm consent/privacy framing.
- `MobileSkillsHuntPublic.tsx:24` (should-fix, brandvoice) — "Gamified talent scouting" for finding survivors — reframe toward dignity.
- `MobileDirectoryPublic.tsx:109` (should-fix, copy) — "label someone… may be a survivor — no certainty needed" — confirm consent/privacy alignment.

### ServiceCredits surfaces
- `ServiceCredits.tsx:122` (must-fix, phase) — "Across all 12 mini-apps · Phase 3" — drop "· Phase 3".
- `ServiceCredits.tsx:168` (must-fix, currency) — "≈ $242 USD purchasing power" — delete USD peg; non-fiat framing.
- `ServiceCredits.tsx:134` (must-fix, currency) — "No purchasing power yet" — "No credits to spend yet".
- `ServiceCredits.tsx:9` (should-fix, copy) — unused `DollarSign` import — remove.
- `ServiceCredits.tsx:40` (question, copy) — confirm canonical "12 mini-apps" count and plugin names.
- `ServiceCreditsPublic.tsx:41` (must-fix, currency) — "Your participation has real monetary value" — reword to real-service utility, no money peg.
- `ServiceCreditsPublic.tsx:18` (question, copy) — "12–40 cr" unit — standardize credit unit label.
- `MobileServiceCredits.tsx:64` (must-fix, currency) — "credits ≈ $242 USD" — remove USD equivalent; show only credit balance.
- `MobileServiceCredits.tsx:48` (question, copy) — "Utility token ecosystem" — confirm vs crypto-jargon reading.
- `MobileServiceCredits.tsx:132` (question, copy) — "Formance Ledger" vendor name in UI — confirm exposure or use neutral "open ledger".
- `MobileServiceCreditsPublic.tsx:22` (must-fix, currency) — "real monetary value" — reframe around credit utility.

### Weekly Performance
- `WeeklyPerformance.tsx:28` (must-fix, currency) — `GDP Delta +$1.2M` — SC / non-fiat index / percentage.
- `WeeklyPerformancePublic.tsx:16` (must-fix, currency) — `GDP Delta +$1.2M` (blurred preview) — non-fiat.
- `WeeklyPerformancePublic.tsx:48` (should-fix, currency) — "GDP delta" copy fine; ensure displayed value non-fiat.
- `MobileWeeklyPerformancePublic.tsx:16` (must-fix, currency) — `GDP Delta +$1.2M` — non-fiat metric, drop `$`.
- `MobileWeeklyPerformancePublic.tsx:45` (must-fix, currency) — "GDP delta — tracked week over week" — rename to "Service Credit circulation"/"community activity".
- `MobileWeeklyPerformancePublic.tsx:43` (question, copy) — "the platform" vs canonical "the Hub" — confirm product noun.

### Feed / announcements
- `FeedAnnouncements.tsx:18` (must-fix, phase) — "🚀 Phase 2 Launch: …" title — "Now live: …".
- `FeedAnnouncements.tsx:107` (must-fix, phase) — "#Phase2Launch" hashtag — "#NowLive" / feature tag.
- `FeedAnnouncements.tsx:253` (must-fix, phase) — "Phase 2 launch 🚀" trending item — non-phase label.
- `FeedAnnouncements.tsx:37` (must-fix, currency) — "generated $247B in opportunity" — remove `$` peg.
- `FeedAnnouncements.tsx:31` (should-fix, brandvoice) — urgency-stacking ("⚠️" + "URGENT" badge + "Urgent:" + "immediately") — keep one urgency signal.
- `MobileFeed.tsx:11` (must-fix, phase) — "🚀 Phase 2 Live: …" — "Now Live: …".
- `MobileFeed.tsx:14` (must-fix, currency) — "$247B economy" — non-fiat framing.
- `MobileFeed.tsx:14` (should-fix, brandvoice) — "🎉 5 Million Members Worldwide! … This is YOUR economy" growth-hype — soften to calmer community tone.
- `MobileFeed.tsx:13` (question, currency) — "12 accept ServiceCredits" — confirm canonical term (no peg present).
- `MobileFeedPublic.tsx:29` (should-fix, copy) — "Housing Navigators" — confirm canonical role name.

### Chyme / Directory
- `ChymeEmpty.tsx:27` (must-fix, phase) — `Phase 0` badge — remove / use "Beta"/"Preview".
- `Chyme.tsx:358` (question, copy) — `Chyme.tsx` and `ChymeApp.tsx` are byte-identical full copies — confirm Chyme should re-export from ChymeApp to avoid drift.
- `ChymePublic.tsx:124` (question, copy) — "Safe Space ✓" badge vs Chyme.tsx "Safe Space Room" — confirm canonical name and capitalization.
- `Directory.tsx:20` (must-fix, phase) — `phase` field / "Phase N" in all PROFILES (20–25) — remove field.
- `Directory.tsx:80` (must-fix, phase) — rendered `{p.phase}` Badge on profile detail — remove.
- `Directory.tsx:98` (should-fix, brandvoice) — "Anonymous Survivor" — acceptable; confirm consistent capitalized "Survivor".

### Mood / GentlePulse
- `Mood.tsx:111` (must-fix, phase) — "Zero tracking · Community wellness · Phase 2" — drop "Phase 2".
- `MoodEmpty.tsx:31` (must-fix, phase) — `Phase 0` badge — remove.
- `Mood.tsx:42` (should-fix, copy) — "23% of our community felt the same this week" after disclosure — lead with resources; clinical review recommended.
- `MobileMood.tsx:86` (should-fix, copy) — "4.9M survivors" — verify count vs canonical metric.
- `MobileMood.tsx:116` (question, copy) — "Crisis Handled" label — reword to "Crisis Support Provided"; confirm surfacing a crisis count is appropriate.
- `GentlePulseEmpty.tsx:30` (must-fix, phase) — `Phase 2` badge — remove.
- `GentlePulse.tsx:105` (should-fix, copy) — "48 sessions" contradicts 6-item SESSIONS array; "Zero triggers" overpromises — reconcile count; soften to "designed to minimize triggers".
- `GentlePulse.tsx:2` (should-fix, copy) — unused icon imports — trim.
- `MobileGentlePulse.tsx:115` (should-fix, brandvoice) — all-caps "DO" reads as shouting — sentence case.

### SocketRelay / TrustTransport (mutual aid + rides)
- `SocketRelay.tsx:92` (must-fix, phase) — "Privacy-minimized · Phase 2" — drop / "Mutual Aid · Live".
- `SocketRelayEmpty.tsx:28` (must-fix, phase) — `Phase 0` badge — remove.
- `SocketRelayPublic.tsx:26` (must-fix, currency) — `$0` "Cost to post" — use "Free", drop `$`.
- `SocketRelay.tsx:126` (should-fix, copy) — lowercase "credits" vs "SC" vs "ServiceCredits" across SocketRelay surfaces — standardize on "ServiceCredits".
- `SocketRelayPublic.tsx:118` (question, copy) — "SC" abbreviation — confirm canonical.
- `MobileSocketRelay.tsx:70` (question, currency) — "{credits} credits" bare count is fine; confirm no later USD equivalent.
- `MobileSocketRelay.tsx:11` (should-fix, copy) — "Need groceries — single mom, 3 kids" stereotyped sample — use a dignity-preserving example.
- `TrustTransport.tsx:109` (must-fix, phase) — "Safety-first · Phase 2" — drop "· Phase 2".
- `TrustTransportEmpty.tsx:27` (must-fix, phase) — `Phase 1` badge — remove.
- `MobileTrustTransport.tsx:51, 74, 109` (should-fix, copy) — "Credits OK" / "Credits" badge / "12 credits" — standardize to "ServiceCredits".
- `MobileTrust.tsx:5` (question, copy) — BRAND `#0284C7` vs `MobileTrustEmpty.tsx:5` `#0EA5E9` for same plugin — confirm canonical brand color.
- `MobileTrustEmpty.tsx:101` (should-fix, copy) — empty `<span>` placeholder node; icon concatenated into label on 103 — render icon in span or remove the empty element.

### Unlock / SkillUp
- `Unlock.tsx:184` (question, copy) — "GDP contribution" term — confirm non-fiat alignment or rename.
- `Unlock.tsx:172` (should-fix, brandvoice) — "Traffickers are less likely to have Quora history" — verify supportable / non-fear-amplifying.
- `SkillUp.tsx:141` (should-fix, currency) — "8,910 SC" with Coins icon is correct — pattern to follow elsewhere.
- `MobileSkillUpPublic.tsx:45` (should-fix, copy) — "+N cr" vs "SC" elsewhere in SkillUp — standardize unit label.

### Landing (web)
- `LandingEmpty.tsx:1`, `LandingFeatures.tsx:1`, `LandingHero.tsx:1`, `LandingLoading.tsx:1` (question→must-fix, marker) — add `// design-sync` as the exact first line (see marker gaps section).
- `LandingFeatures.tsx:4` (should-fix, copy) — component `LandingFeaturesPublic` in file `LandingFeatures.tsx` — reconcile file/component name + state suffix.
- `LandingHero.tsx:3` (should-fix, copy) — component `LandingHeroPublic` in file `LandingHero.tsx` — align names.
- `LandingFeatures.tsx:6` (question, copy) — "Hub" and "LightHouse" both use 🏠 — pick a distinct emoji.
- `LandingHero.tsx:9` (question, copy) — hero leads with "Survivor Hub" not brand "Charging the Future" — confirm intended.
- `LandingHero.tsx:31` (question, copy) — "17" Mini Apps — verify against plugin registry (ServiceCredits says "12 mini-apps"; see Open Questions).

## ClickLog (recently updated) — focused review

ClickLog and MobileClickLog are clean on content — no currency, phase, or trauma-tone violations were flagged in their substantive copy.

- `MobileClickLogPublic.tsx:54` (question, copy) — "Sign in to start logging personal safety incidents — one tap, encrypted, private." Flagged only to confirm incident terminology aligns with brand voice; appears acceptable, no fear-amplifying framing. No change required unless the owner wants terminology tweaks.
- `ClickLogLoading.tsx` and `MobileClickLogLoading.tsx` — both carry the loading slogan "EXIT THEIR ECONOMY EXIT THE PSYOP" (no slash variant). This is the same shared loading-state copy used everywhere else, and inherits the two open issues below: (a) the slash/no-slash punctuation split, and (b) the owner question on whether the activist slogan is the intended trauma-informed loading message.

Verdict: ClickLog needs no content fixes of its own. Its only outstanding items are the project-wide loading-message decisions, not anything ClickLog-specific.

## Loading states — consistency review

Loading screens are nearly uniform but not byte-identical. 40 survivor-hub loading files all carry the same slogan, but split across two punctuation variants, and the single landing loading screen uses an entirely different (and arguably more appropriate) message.

Intended message (per instructions): "EXIT THEIR ECONOMY / EXIT THE PSYOP" (slash variant).

- Conforming (slash variant "EXIT THEIR ECONOMY / EXIT THE PSYOP"): GDPLoading, GentlePulseLoading, HubLoading, SkillUpLoading, MobileFeedLoading, MobileFoundationLoading, MobilePeerProgrammingLoading, MobileServiceCreditsLoading, MobileWeeklyPerformanceLoading, MobileWorkforceLoading, MoodLoading, PeerProgrammingLoading, SkillsTaxonomyLoading, SocketRelayLoading, TrustLoading, TrustTransportLoading, WorkforceLoading — 17 files.
- Outliers — no-slash variant "EXIT THEIR ECONOMY EXIT THE PSYOP" (should be normalized to the slash form): ChymeLoading, ClickLogLoading, DirectoryLoading, FeedAnnouncementsLoading, FoundationLoading, LightHouseLoading, MobileChymeLoading, MobileClickLogLoading, MobileDirectoryLoading, MobileGDPLoading, MobileGentlePulseLoading, MobileHomeLoading, MobileSkillUpLoading, MobileLightHouseLoading, MobileMoodLoading, MobileSkillsHuntLoading, MobileSkillsTaxonomyLoading, MobileSocketRelayLoading, MobileTrustLoading, ServiceCreditsLoading, SkillsHuntLoading, UnlockLoading, WeeklyPerformanceLoading — 23 files.
- Different message entirely: `landing/LandingLoading.tsx` → "Loading Survivor Hub / Preparing your community experience..." This is a calmer, more conventional loading message and does not use the activist slogan.

Summary: Not yet one consistent message. The slogan is effectively universal across survivor-hub, but the slash vs no-slash split (17 vs 23) means a normalization pass is needed. Separately, the landing loading screen diverges by design intent or by oversight — owner should decide whether all loaders should match the activist slogan or whether the calmer landing-style message is preferred app-wide (see Open Questions).

## 4-state completeness gaps

Required states: Public / Empty / Loading / Populated.

| Platform | Component | Missing states |
|---|---|---|
| Web | ChymeApp | empty, loading, public |
| Web | Desktop | empty, loading, public |
| Web | GDPPublicAlt | empty, loading, public |
| Web | Hub | populated |
| Web | Landing | populated, public |
| Web | LandingFeatures | empty, loading, public |
| Web | LandingHero | empty, loading, public |
| Mobile | Home | public |
| Mobile | Hub | populated, empty, loading |
| Mobile | TrustTransport | loading, public |
| Mobile | WeeklyPerformance | populated, empty |

Web has 7 components with gaps; Mobile has 4. The landing family (Landing, LandingFeatures, LandingHero) and the Hub surfaces (Web:Hub, Mobile:Hub) are the most incomplete. These gaps require new design work from Replit, not app-side edits.

## design-sync marker gaps

The following files do not have `// design-sync` as the exact first line, which breaks the manifest contract. All four are in the landing family:

- `design/artifacts/mockup-sandbox/src/components/mockups/landing/LandingEmpty.tsx`
- `design/artifacts/mockup-sandbox/src/components/mockups/landing/LandingFeatures.tsx`
- `design/artifacts/mockup-sandbox/src/components/mockups/landing/LandingHero.tsx`
- `design/artifacts/mockup-sandbox/src/components/mockups/landing/LandingLoading.tsx`

Fix (Replit, design repo): insert `// design-sync` as line 1 of each file, pushing the existing `import React from "react";` to line 2. The `survivor-hub` files already carry the marker.

## Open questions for the owner

1. How should the credit economy's scale be expressed without fiat? Every economy/GDP surface currently uses `$247B` / `$300B`. We need the canonical non-fiat replacement: a ServiceCredits volume (e.g. "247B SC circulated"), a unitless activity index, or member/milestone counts. Pick one so Replit can apply it uniformly.
2. Should ServiceCredits show any per-member value at all? Current copy uses "≈ $242 USD purchasing power" and "real monetary value." Decide whether to show only a raw credit balance (e.g. "2,420 credits"), a utility statement ("usable across all 12 mini-apps"), or nothing — and whether "purchasing power"/"utility token" framing is allowed.
3. External real-world rent in LightHouse: Housing listings show actual fiat rent (`$850/mo`, `$1,000`, pricing-guide ranges) beside "Accepts ServiceCredits." Is showing real-world landlord rent in USD an allowed exception, or must all LightHouse pricing be denominated in ServiceCredits? This affects LightHousePublic, MobileLightHouse(Public), and LightHouse.tsx.
4. External provider rates in Foundation: Same question for tradesperson `$/hr` rates next to "Credits OK" — convert to credits, or allow fiat rates for external providers?
5. Loading message — activist slogan vs calm copy: Is "EXIT THEIR ECONOMY / EXIT THE PSYOP" the intended trauma-informed loading message for a survivor audience mid-load, or should it be replaced with the calmer landing-style copy ("Preparing your community experience…")? If the slogan stays, confirm the slash variant is canonical so the 23 no-slash files can be normalized.
6. Canonical mini-app / member counts: LandingHero says "17 Mini Apps"; ServiceCredits says "12 mini-apps"; member counts vary between "4.9M survivors" and "5M+ Members." Provide the authoritative numbers (or confirm they're illustrative placeholders) so Replit can reconcile.
7. Consent model for nominating survivors: SkillsHunt/Directory invite users to nominate third parties as possible survivors "no certainty needed." Confirm this is intended and that consent/privacy/notification handling is acceptable, or specify required guardrail copy.
8. "GDP" as a product term: "GDP", "GDP Tracker/Dashboard", "GDP Delta", "By Phase" filters, and the "GDP" nav label all use a fiat-macroeconomics word. Decide whether "GDP" is retained as product vocabulary or replaced with a non-fiat term (e.g. "Economy" / "Service Credit circulation").
9. Trauma-tone reframes: Confirm the direction for "stop needing/depending on traffickers", "reduces infiltration", and "gamified talent scouting" — approve the suggested self-sufficiency/safety reframes or provide preferred wording.
10. Canonical credit unit label: Surfaces variously use "ServiceCredits", "SC", "credits", and "cr". Confirm the one canonical spelling and abbreviation for Replit to standardize.
11. Chyme duplication and Trust brand color: Confirm Chyme.tsx should re-export from ChymeApp.tsx (currently byte-identical copies), and which Trust brand color is canonical (`#0284C7` vs `#0EA5E9`).

## What the app side can do now

Per the agreed model, all copy and design fixes live in the `design/` submodule and are Replit's to apply; the app produces the list and never edits the design repo. So the app side's immediate, in-scope actions are limited:

1. Deliver this list to the Replit design agent as the authoritative fix list (the "List for Replit" section above), along with the Open Questions for owner decisions.
2. Hold on production-shell changes. Do not port any of these surfaces into the app's production shells yet — the mockups still contain banned fiat/phase copy and unresolved owner decisions.

App-repo follow-ups (only after Replit fixes land and the submodule is re-pinned to the corrected commit):

3. Re-pin the `design/` submodule to the commit that includes the currency/phase/marker fixes, then re-run the per-file audit to confirm zero must-fix findings remain.
4. Re-run the design-sync manifest check to confirm all landing files now carry the line-1 marker (the manifest contract currently breaks on those four files).
5. Update production shells for the corrected surfaces, gated by the Design Pass requirement — and verify the non-fiat credit-economy strings and absence of phase words at integration time, so regressions don't re-enter via the app side.
6. No schema/API/contract changes are implied by this audit — every finding is design-repo copy/structure, so there are no app-side migrations, route changes, or inventory updates to make at this time.

---

## Addendum — the 8 files from the failed batch

These were re-audited directly after the main run.

Must-fix:
- `MobileWeeklyPerformance.tsx:17` (currency) — `GDP Delta` value `+$1.2M` pegs the economy metric to fiat. Replace with ServiceCredits (`+1.2M SC`) or a non-fiat index; drop `$`.

Should-fix / questions:
- `MobileUnlock.tsx:130` vs `MobileUnlockEmpty.tsx:121` (copy) — unlocked-benefit lists diverge ("Plugin marketplace" vs "All plugins"; `MobileUnlock` adds "GDP contribution"). Align across all three Unlock states.
- `MobileUnlockEmpty.tsx:65,103` / `MobileUnlockPublic.tsx:86` (brandvoice, borderline) — "infiltration risk" / "reduces infiltration" / "fake survivor accounts": framed protectively but verify not fear-amplifying.
- `MobileWeeklyPerformanceEmpty.tsx:51` (copy) — keep the `GDP Delta` label in sync with the renamed populated card.

Metadata: all 8 files carry the `// design-sync` marker on line 1 (no marker gaps here). The two Loading files render the slogan as two stacked lines ("EXIT THEIR ECONOMY" / "EXIT THE PSYOP") with no literal slash character — see caveat below.

> Loading-slash caveat: the slogan is rendered as two separate stacked lines, not a slash-joined string. The "slash vs no-slash variant" split in the synthesis above reflects how each reader agent transcribed two-line copy, and is largely a transcription artifact rather than 23 genuinely divergent files. The real owner decision is whether the activist slogan is the right loading message at all (Open Question 5), not the punctuation.
