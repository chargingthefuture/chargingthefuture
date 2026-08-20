# Quora Research — Brief for the Blog-Writing Agent

Feed this to the agent that writes the blog. It describes the two Quora datasets this project
collects, where the survey lives so posts can link to it, and the rules for what may and may not be
said about the numbers.

Keep it in sync with the two feature inventories, which are the source of truth:
`ctf/docs/developer/ctf-plugin-feature-inventories/ctf-quora-deletion-survey-feature-inventory.md`
and `ctf-quora-live-census-feature-inventory.md`. If this file and an inventory disagree, the
inventory wins.

---

## What you are working with

Two separate datasets that answer different questions. Neither answers the other's question, and
most wrong claims come from treating one as if it were the other.

| | Account-removal survey | Live account census |
|---|---|---|
| What it records | Accounts **Quora closed**, reported by the person who lost them | Accounts **still standing** on a fixed date |
| Where it comes from | Self-report, through a public form | Observation, by an admin reading Quora |
| Answers | How often removals happen, to whom, writing about what | What remains, and what subject matter it covers |
| Cannot answer | What survives | How much was removed (with one exception, below) |

## Where the survey lives

Public form, linkable from anywhere:

```
https://app.chargingthefuture.com/survey/quora-account-deletions
```

Reading it needs no account. Submitting needs a free sign-in — that keeps bulk junk out of a table
meant to be citable, and is not a claim that the person is verified.

Inside the app, members reach it from two places, both sitting where they have just been asked for
a Quora profile URL: the Unlock verification screens, and the Directory profile edit screen. When a
post tells readers how to take part, the public link above is the one to give — it works for people
with no account, which is most of the audience.

## What the survey collects

Per person: whether they consider themselves a targeted individual (yes/no, required), whether at
least one account was removed (yes/no, required), whether they still hold an account that was not
removed (optional), free-text evidence, free-text notes, and three separate publication consents.

Per closed account, one card each, up to 25:

- The handle.
- What happened: the whole account was deleted / banned or suspended / answers or posts removed with
  the account kept / a Space they ran was removed / blocked from posting. Every option is something
  Quora did — there is no self-closure option, so nothing self-initiated is in this data.
- Month and year, either optional.
- The reason Quora gave: no reason was given / spam / harassment or bullying / misinformation /
  impersonation or a fake name / adult content / making a new account after a ban / something else /
  I do not remember. "No reason was given" is expected to be the most common and is an answer in its
  own right, not a blank.
- Whether they appealed, and whether anything was restored.
- What the account mostly wrote about (subject list below).
- Rough post count and rough months active, both optional.

**The removal count is the number of account cards, never a number anyone typed.** So every removal
in a total carries a handle and a date behind it.

## What the census collects

Per run: the observation date, what was searched, how accounts were picked, and the **frame kind**.
A run is closed when finished, and a closed run refuses new entries, so a number that has been
quoted cannot change afterwards.

Per account observed: handle, profile link, state when checked (still live / gone when checked /
renamed or moved), subject matter, stance, rough answer count, last active year, archive link.

Stance values are: practical help (what to do, what worked) / organizing (groups, meetups, building
something) / personal account (their own experience) / cannot tell from the account / not about
targeting at all.

## The subject list, shared by both

Both datasets code subject matter with the same list, so they can be compared:

targeting and gang stalking · surveillance and harassment tactics · coping, support, encouragement ·
legal steps and reporting · organizing, meetups, community building · subjects unrelated to targeting

## Rules for publishing — these are hard

### Never publish a handle or a quote without the matching consent

Each survey response carries three separate yes/no consents, all defaulting to no:

1. the handles may be published,
2. the words may be quoted,
3. the handle may be attached to that quote.

A handle appears in a post only when 1 is yes. A quote appears only when 2 is yes. A quote appears
**next to a handle** only when 2 and 3 are both yes. Consent 2 without 3 means the words may be
used and the person may not be named.

A response with all three off still counts in every total. Nothing is lost by someone declining.

Census handles carry **no consent at all**. Every census row is an observation about a real person's
public account, recorded without asking them. Publish counts from the census; do not publish the
handles in it.

### Never state a share of Quora, or of targeted individuals

Report counts, and say what they are counts of. "Forty-one removals reported by twenty-three
people" is publishable. "Forty percent of targeted individuals have lost accounts" is not, from
either dataset.

For a census run, a percentage is a share **of that run** and must be labeled that way: "of the 60
accounts in the 3 March list, 22 were gone." Never "of Quora."

### Say it is self-report

Nothing in the survey is checked against Quora. It records what people say happened. Say so once
in any post that uses the numbers.

### Selection bias runs one way, from two causes

Only someone who found their way to another platform can answer at all, and only someone willing to
make an account can submit. So the survey counts people who kept going and were willing to sign up,
and misses everyone else. Every survey total is a **floor**, never an estimate of the whole.

### A removal rate is readable from only one kind of census run

A run built by searching Quora during the run cannot show removals at all — a search today cannot
return an account that no longer exists, so the accounts that were taken are missing from the
results by construction. Only a run built from a list assembled **before** the removals supports
"how many of a fixed set are gone," because its denominator was fixed in advance.

Check the run's frame kind before writing any removal figure from the census. If it says the
accounts came from searching during the run, that run can describe what remains and nothing else.

### The census cannot speak to tone

It records what accounts are **about** and whether they are still standing. It does not code how
discouraging, hopeless, or defeatist an account is — those values were deliberately removed. So no
claim of the form "what remains is mostly people telling each other to give up" can be supported by
this data, however the numbers look. If a post wants to make a claim about tone, it needs evidence
this project does not currently collect, and the post should say the claim is an impression rather
than dress it in a number.

### A run with a large "cannot tell" share is a thin reading, not an ambiguous population

"Cannot tell from the account" is the stored default. A high share of it means the coder did not
look closely enough, not that the accounts were genuinely unclear. Do not report it as a finding.

## How to cite a number

Give the reader enough to check it:

- Survey: the count, how many people it came from, and the date range of the reports.
- Census: the count, the observation date, what was searched, how accounts were picked, and the
  frame kind. A census number without its date and method is not usable.

## When the data does not support the point

Say the point plainly as an impression, and say the data does not yet test it. That is honest and
still worth reading. Do not stretch a number to cover it, and do not present a count from one
dataset as evidence for the other's question.
