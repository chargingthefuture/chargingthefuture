# ClickLog trend report — method, limits, and what an investigation would still need

This document travels with the ClickLog trend report. It is written to be read on its own, by
someone who has never used this app: a journalist, a lawyer, or a human-rights body looking at the
numbers for the first time. Every claim about how the data is collected can be checked against the
code named at the end.

The short version of the method is drawn into the report image itself, so a copy of the image
posted anywhere carries its own provenance. This file is the long version.

---

## 1. What the report is

Members of Charging The Future record incidents in a feature called ClickLog — one entry at a time,
on the day it happens. Each entry can carry a written note, a location, and tags chosen from two
fixed lists: known problems ("what happened to you") and named schemes ("what was used on you").

The report counts **only** the incidents members chose to share. It is an aggregate: counts by day,
counts by approximate area, counts by tag, and counts of how many different members are behind
them.

## 2. How a member's consent works

- Sharing is **off** unless the member turns it on. There is a global default (off) and a
  per-incident choice.
- An untagged incident stays entirely private if the member leaves sharing off. It never reaches
  the aggregate.
- Tagging an incident **requires** sharing its trend data, and the app says so in plain words before
  the member saves. Tags exist to feed the aggregate; an incident tagged in private would be a tag
  that does nothing.
- A member can turn sharing off again on any untagged incident at any time, and can delete any
  incident, which removes it from every future report.

## 3. What is counted, and what is never counted

Counted:

| Field | Precision |
|---|---|
| Date | The UTC day. No time of day. |
| Location | Latitude and longitude rounded to one decimal place — an area roughly 11 km across. |
| Problems | Which items the member picked from a fixed list of known problems. |
| Schemes | Which items the member picked from a fixed list of named schemes. |
| Member count | How many **different** members are behind a set of incidents. |

Never counted, and never visible to anyone including the project's owner:

- The member's written note. It is stored for the member and is excluded from every report query.
- The member's exact location. Only the rounded cell above is ever read.
- Who the member is. Member identity appears in the reporting queries only inside
  `COUNT(DISTINCT …)` — as a number of people, never as a list of people.
- The incident's identifier, so no two figures in the report can be joined back to one entry.

This is enforced in the database queries themselves, not in the screen that displays them. A future
change to the display cannot widen what the report can see.

## 4. How to read the counts

- **A count is the number of times members reported something, not the number of times it
  happened.** Most incidents in anyone's life are never logged.
- **Incidents and people are different numbers.** Seven incidents from one member and seven from
  seven members describe very different situations. The report always shows both.
- **Repeat reporting matters more than volume.** The number of members who logged more than one
  incident is the figure that separates a sustained pattern from isolated events.
- **Scheme counts are not comparable to each other.** Some named schemes describe a condition that
  runs continuously in the background and can be reported almost any day; others describe a single
  operation with a start and an end. The report labels each row with which kind it is. A larger
  count on a continuous one does not make it more frequent or more serious than a smaller count on
  an operation.
- **Categories count each incident once.** An incident carrying three problems from the same
  category adds one to that category, not three.

## 5. What the report cannot show

- **It is not verified.** These are first-hand accounts recorded by the people they happened to.
  Nothing here has been checked against police reports, medical records, video, or any other
  outside source. The report is a record of what members say happened, which is exactly what it
  claims to be and no more.
- **It is not a sample of any population.** The people logging chose to join this app and chose to
  share. No rate, prevalence, or per-capita figure can be calculated from it, and none is offered.
- **It cannot see outside its own lists.** Anything that is not on the fixed problem list or the
  fixed scheme list is not counted at all. Both lists grow, through a member suggestion process, so
  a term appearing for the first time can mean the term is new rather than the conduct.
- **Location coverage is partial.** An untagged incident can be logged with no location, so some
  incidents are counted in every figure except the area breakdown. The report states how many.
- **The window is 90 days.** Older incidents still exist for the member; they are outside the
  report.

## 6. Why the area cells are usually left out of a shared copy

The report can be saved as a single image for posting. That image leaves the area coordinates out
unless they are explicitly asked for, and the reason is not caution for its own sake: at low counts,
an area roughly 11 km across combined with a specific date can point at one person for anyone who
already knows them. Members consented to their trend data reaching the project. Publishing an area
and a date is a wider disclosure than that, so it is a decision made deliberately each time rather
than a default.

Anyone requesting the underlying area detail for an investigation should ask for it directly rather
than take it from a public copy.

## 7. What an investigation would still need, and what to build for it

The report answers *what kind of thing is being reported, by how many people, over what days, in
roughly what places*. A human-rights body assessing whether it has a mandate and what to do next
would still ask for the following. None of it exists yet. Each item is a change to what members are
asked when they log, so each is a product decision for the owner, not a reporting change.

In order, with the blocking dependencies stated:

1. **Country and region on each shared incident.** The single largest gap. Today an outside reader
   has to look up coordinate cells by hand, and incidents with no location have no place at all. A
   country field derived from the location at logging time — coarse, stored alongside the cell —
   makes the report readable by anyone and makes cross-border patterns visible. Nothing else in this
   list depends on it, so it can be done first and on its own.
2. **Who the member says was involved.** Whether the conduct is attributed to state actors, private
   parties, or is unknown, as a coarse choice with "unknown" as a real and common answer. This
   decides which body has a mandate at all, and no aggregate can be acted on without it. Blocked by
   nothing technical; blocked on the owner deciding the wording, because a badly worded question
   here produces confident answers to something the member cannot actually know.
3. **What the member did about it, and what happened.** Whether the incident was reported to police,
   an employer, a regulator, or a doctor, and what came of it. Complaint procedures ask whether
   domestic remedies were tried before anything international is considered, and a pattern of
   reports that went nowhere is itself a finding. Depends on item 2 only in that both are answered
   in the same place in the form; either order works.
4. **A coarse severity or consequence field.** Whether the incident cost the member a job, housing,
   money, medical treatment, liberty, or physical injury. Counts of conduct without consequence
   read as a nuisance log; consequence is what makes it a rights question. Independent of the
   others.
5. **Whether corroborating material exists.** Whether the member holds video, documents, messages,
   or a witness — as a yes/no, with the material never uploaded. It lets an investigator ask for
   the small number of incidents worth following up instead of asking everyone for everything.
   Independent of the others.
6. **Consent to individual follow-up.** A separate, explicit opt-in, distinct from trend sharing:
   whether the member is willing to be contacted about their own case by a named body. No Special
   Procedure can act on aggregate numbers alone; it acts on individual cases with the consent of
   the person concerned. This is the item that converts the report from context into something that
   can be acted on, and it is blocked by items 1–5, because a member should know what they are
   consenting to being contacted about before being asked.
7. **A written statement of the sample.** How many members the app has, how many use ClickLog, and
   how many share — so a reader can see what fraction of the community the report covers. Blocked
   by nothing; it is a reporting change, not a collection change, and it is the cheapest of the
   seven.

Two things that are deliberately **not** on this list. Demographic data about members is not
collected and should not be added merely because an analysis would be richer for it. And the note a
member writes stays private permanently; if free-text accounts are ever needed for a submission,
they should be collected fresh with their own consent, not taken from what members wrote for
themselves.

---

## Where this is implemented

| Concern | File |
|---|---|
| Fixed problem and scheme lists | `ctf/packages/web/lib/click-log/tags.ts` |
| Harm categories and scheme kinds | `ctf/packages/web/lib/click-log/tag-categories.ts` |
| Reporting queries (the privacy boundary) | `ctf/packages/web/lib/click-log/report-repository.ts` |
| Report assembly | `ctf/packages/web/lib/click-log/report.ts` |
| The words in the report and the image | `ctf/packages/web/lib/click-log/trend-report-view.ts` |
| The shareable image | `ctf/packages/web/lib/click-log/report-image.tsx` |
| Access control | `ctf/packages/web/lib/click-log/policy.ts`, `ctf/packages/web/app/api/click-log/_lib.ts` |

The plugin's full feature record is
`ctf/docs/developer/ctf-plugin-feature-inventories/ctf-click-log-feature-inventory.md`.
