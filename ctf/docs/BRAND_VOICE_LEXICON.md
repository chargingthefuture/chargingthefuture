# Brand Voice Lexicon

This document is the canonical source of truth for brand language across:

- ctf/
- landing-page/
- waitlist-landing-page/
- wiki-blog/

## Purpose

- Standardize language so users experience one coherent brand voice across all surfaces.
- Keep language trauma-informed, plain, respectful, and non-stigmatizing.
- Define the official Specterati terminology and where it can be used.

## Brand Identity Hierarchy

- Charging the Future: organization and umbrella brand name.
- TI Skills Economy: product name for the ecosystem.
- Psyop-Free Economy: positioning phrase used in campaign and mission framing.
- TI: Targeted Individual.

## Mission and Core Line

- Mission: Charging the Future empowers people to Live, Work, and Prevail with clarity, critical thinking, and authenticity.
- Core line: Live, Work, and Prevail.

## Voice Principles

- Calm and predictable: low-pressure wording and clear action paths.
- Empowering: reinforce agency, consent, and user control.
- Plain language: avoid jargon, fear amplification, and vague slogans.
- Respectful: avoid stigmatizing labels, mockery, and demeaning phrasing.
- Specific and honest: describe what the product does without hype inflation.

## Canonical Terminology

- Survivors is the default user descriptor in UI and editorial content.
- Victims is only allowed in legal, statutory, or externally quoted contexts.
- Prefer named capabilities over generic labels — never a bare "Chat".
- **Commons**: the homepage community chat — the shared, many-voices space where members post to everyone. Use "the Commons" (capital C) for the home chat surface; its nav uses a community (people) icon.
- **Direct Line**: the private, one-to-one chat paired with a single plugin transaction — a LightHouse match, a SocketRelay request, a TrustTransport trip, a Foundation quote. Use "Direct Line" for that paired chat; its nav uses a single-bubble icon. ("LightHouse Direct Line" etc. is fine when the plugin needs naming.)
- Group rooms are not a Direct Line: a many-people room (for example Chyme's audio-room chat) stays "Room Chat", since Direct Line means one-to-one.

## Specterati Lexicon

- Specterati operate a dopamine-exploitation harassment economy; funded through money laundering via the global economy.
- Specterati: replacement for colloquial labels such as gang stalking and gang stalker.
- Specter: a ghostly apparition, symbolizing the unseen and insidious nature of stalking and harassment.
- -ati: a suffix that denotes a group or collective.
- Specterwave: a pervasive influence that spreads fear and control.
- Specterforce: a powerful, unseen entity that enforces compliance.
- Spectervox: combines specter with vox (voice), signaling suppression of dissenting voices.
- Specterbane: a destructive force that seeks to eliminate individuality and freedom.
- Specterrealm: a domain ruled by fear and intimidation.
- Specterrise: a rise in sinister activity and dominance in society.

## Specterati Placement Tiers

- Tier 1 Editorial and explanatory content:
  - wiki-blog articles and wiki dictionary content
  - onboarding explainers
  - long-form educational sections such as look-ma-i-fixed-it
- Tier 2 Contextual UI support text:
  - help text, tooltips, and safety education labels
  - use only when explanatory context is present
- Tier 3 Restricted from use:
  - generic CTA labels
  - error and validation messages
  - accessibility labels and placeholders

## Approved Substitutions

- gang stalking -> Specterati harassment
- gang stalker -> Specterati operator
- victims -> survivors (except legal or statutory contexts)
- home/community chat -> the Commons
- a plugin's one-to-one transaction chat -> Direct Line (for example LightHouse Direct Line)
- punch list -> remaining work (or task list)
- console (as the name of an operator/admin screen) -> dashboard

## Prohibited Patterns

- Sensational, exploitative, or fear-escalating copy.
- Demeaning language about users or third parties.
- Manipulative urgency language on product surfaces.
- Ambiguous euphemisms that hide product behavior.
- Borrowed industry jargon that adds no meaning. Do not use "punch list" — it is opaque
  construction-trade jargon; say "remaining work" or "task list". Applies to docs, code comments,
  PR/commit text, and inventories, not just user-facing copy.
- Do not call an operator/admin screen a "console" — the app's word for such a screen is
  "dashboard". This covers visible labels, comments, docs, and code identifiers (component, file,
  and CSS class names). Exempt: the JavaScript `console.*` logging API, the literal `console`
  service in the Formance stack, and third-party product names that are actually called a console
  (for example the Neon Console). Enforced in chat by `.claude/hooks/check-no-pleasantries.mjs`.

## Canonical Capability Names (Public Surfaces)

- LightHouse
- TrustTransport
- Workforce Recruiter
- SupportMatch
- Directory
- SocketRelay
- CompareNotes
- GentlePulse
- Chyme
- LostMail

When these names are updated, change this lexicon first, then update all copy surfaces.
