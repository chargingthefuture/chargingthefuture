# AI Assistant (@comic) — Manual Test Script

Covers the member-facing contribute surface. The `@comic` question/answer flow and the admin review
dashboard are exercised through the feed test script and the admin walkthroughs; this file starts
with the contribution intake because its promises are ones a member is asked to trust before they
hand over anything.

**Read this first:** most of what follows is checking that something did *not* happen — that a
private section was dropped, that a file was not kept, that a refusal came before a read. Those are
the tests worth running slowly.

---

## CMC-C0 · The landing page, and contributing as the way in
**Role:** a signed-out visitor, then a brand-new signed-in member who has NOT verified
**Steps:**
1. Signed out, open `/knowledge`.
2. Sign up as a fresh account that has never submitted a Quora URL, and open `/knowledge` again.
3. Tick the six consent lines, paste a post, paste your own Quora **profile** link in the field that
   appears, and send.
4. Open `/admin/unlock` as admin.
5. As a member who **already** has a Quora URL on file, open `/knowledge`.
6. As a fresh unverified member, send a contribution with a Quora **post** link (not `/profile/`) in
   that field.

**Expected:**
- Step 1 → the **public landing page**, not a redirect to sign-in. It says what the library is, what
  happens to your writing, that you can take it back, and that contributing also verifies you. This
  is the page the invitation post links to from Quora, so a visitor with no account has to be able to
  read it and decide.
- Step 2 → the form loads. An unverified member is **not** turned away — contributing is the way in,
  not something behind the gate.
- Step 3 → send is blocked until the profile field is filled; the receipt then says the Quora profile
  went in for verification at the same time.
- Step 4 → a **pending** submission for that member is in the queue, with an audit row tagged
  `source: comic_knowledge_contribution`. **Pending, never auto-approved** — the point is that one
  review covers both questions, not that review is skipped.
- Step 5 → **no Quora URL field at all.** A member who already has one on file is never asked again,
  so two conflicting URLs cannot reach one account by this route.
- Step 6 → the writing is still kept and the receipt says verification did not start. Losing
  someone's writing over a malformed link would be the wrong trade.

**Result:** web ☐

---

## CMC-C1 · Pick a few posts (the default path)
**Role:** signed-in member · **Surfaces:** web + mobile-responsive
**Precondition:** two of your own public Quora posts.

**Steps:**
1. Open `/knowledge`.
2. Check which option is selected before you touch anything.
3. Before ticking any consent line, try to type in a post box.
4. Tick all six consent lines. Paste one post's Quora link and its full text, press **Add another
   post**, and fill the second. Send.

**Expected:**
- **"Pick a few posts" is selected by default** — the whole-export option is there but is not the
  starting point. Most people's writing is mixed, and only the author can say which posts belong.
- At step 3 the link and text boxes are **disabled**, with "Tick all six consent lines above to add
  your posts." Consent always comes before the content, never after.
- There is **no single "I agree to all"** checkbox anywhere — six separate boxes.
- After sending, a receipt names how many pieces were kept and says only what you pasted was kept —
  nothing else from your account was read or stored.
- The contribution appears under "What you have sent" as **Waiting to be read**.

**Result:** web ☐

---

## CMC-C1b · Picked posts are validated, and links are never fetched
**Role:** signed-in member
**Steps:**
1. Tick the six lines, then try to send a post with a link to somewhere that is not Quora.
2. Try two boxes with the same Quora link.
3. Try a post whose text is one short sentence.
4. Send a valid pair, then check `comic_contribution_entries` in the database.
5. While the request runs, watch outbound network traffic from the server.

**Expected:**
- Step 1 → refused, "Post 1 needs a link to the post on Quora."
- Step 2 → refused as a duplicate link.
- Step 3 → refused with "Paste the whole post — a line or two is not enough for the assistant to
  answer from." (Not a quality judgment — the reviewer would only discard it, so saying so now saves
  the contributor the wait.)
- Step 4 → each row has the pasted text in `content` and the link in `source_url`. Contact details
  and any URLs inside the text itself are redacted; the source link survives separately because it is
  provenance a reviewer needs.
- Step 5 → **the server never requests the Quora page.** Nothing scrapes the link. A post edited or
  deleted between paste and read must not be able to change what was contributed.

**Result:** web ☐

---

## CMC-C1c · Whole export (the secondary path)
**Role:** signed-in member
**Precondition:** a real Quora export `.zip` (Settings → Privacy → Download your information).

**Steps:**
1. On `/knowledge`, choose **Send my whole Quora export**.
2. Before ticking anything, try to choose a file.
3. Tick all six consent lines, then choose the `.zip` and send it.

**Expected:**
- At step 2 the file picker is **disabled**.
- After sending, the receipt names how many public pieces were kept, lists what was deleted on
  arrival (for example "your private messages, your unpublished drafts"), and says the `.zip` itself
  was not stored.

**Result:** web ☐

---

## CMC-C2 · The private sections really are dropped
**Role:** signed-in member, then someone with database access
**Precondition:** a Quora export from an account that HAS inbox messages and at least one draft.

**Steps:**
1. Contribute that export.
2. In the database, read every row of `comic_contribution_entries` for that contribution.
3. Search those rows for a phrase you know appears only in one of your private messages, and for a
   phrase that appears only in an unpublished draft.

**Expected:**
- Neither phrase is present anywhere. The private sections were dropped before storage.
- The receipt in the UI named those sections as discarded — the member is told, not just protected
  quietly.
- No copy of the uploaded `.zip` exists on the server. It is never written to disk.

**Result:** web ☐

---

## CMC-C3 · Hostile and wrong files are refused
**Role:** signed-in member
**Steps:**
1. Tick all six lines, then upload a plain `.txt` renamed to `.zip`.
2. Upload a real `.zip` that contains no `index.html` (any random archive).
3. Upload an empty file.
4. Upload a file larger than 25 MB.

**Expected:**
- Each is refused with a message naming the actual problem — not a generic failure, and not a stack
  trace or file path. Nothing is stored in any case.
- The wrong-file message tells the member to send the Quora file as it arrived, without unzipping.
- Nothing from any of these files is ever executed, and no extracted directory appears on the server.

**Result:** web ☐

---

## CMC-C4 · Consent cannot be skipped or faked
**Role:** signed-in member, using browser developer tools
**Steps:**
1. Tick all six lines, choose a file, and before sending, use developer tools to POST to
   `/api/comic/contributions` with `agreedClauseIds` missing one clause id.
2. Repeat with all six ids but an older `consentVersion` string.
3. Repeat with no `x-ctf-csrf` header.

**Expected:**
- Step 1 → 400, "Every consent statement has to be agreed to before anything can be sent."
- Step 2 → 400 telling the member the wording changed and to reload and read it again. This is the
  case that matters: a page cached from before a consent change must never be recorded as agreement
  to wording it never displayed.
- Step 3 → refused by the CSRF check.
- In all three the file is **never parsed** — consent is checked first, so a submission without it is
  ignored rather than processed and then rejected.

**Result:** web ☐

---

## CMC-A1 · Review: accept, and what the credits do
**Role:** admin, plus two contributors — one **verified (Unlock complete)** and one **not yet verified**
**Steps:**
1. Have both contributors send a contribution from `/knowledge`.
2. Open `/admin/comic/contributions`.
3. On the verified member's card, press **Leave out** on one entry, then press it again and confirm
   it toggles back with **Put back**.
4. Press **Accept N of M**.
5. Repeat on the not-yet-verified member's card.
6. Check `comic_knowledge_entries` and the contributors' ServiceCredits balances.

**Expected:**
- Every entry is shown **in full**, not summarized — the decision cannot be made from a count.
- Nothing is excluded by default: entries start included and the reviewer opts one OUT. A skim must
  not be able to silently drop someone's writing.
- If the contributor wrote a third-party note, it appears **at the top of the card**, highlighted —
  that is the thing to check before promoting anything.
- After step 4: the left-out entry is **not** in `comic_knowledge_entries`; the kept ones are, each
  carrying `contribution_id`. The screen says how many were added and that the credits were granted.
- After step 5: the writing is in the library, and the screen says **no credits, because that member
  is not verified yet**, and that the grant can be made once they finish Unlock. This is a decision,
  not a failure — it must never look like a silent no-op.
- `granted_at` is set only on the verified member's row.

**Result:** web ☐

---

## CMC-A2 · Review cannot double-grant or accept twice
**Role:** admin
**Steps:**
1. Accept a contribution.
2. POST the same accept again to `/api/comic/admin/contributions/<id>/review`.
3. Check the contributor's balance and `comic_knowledge_entries` for duplicates.

**Expected:**
- The second call returns 404 ("not waiting for review") — the status flip and the promotion shared
  one transaction, so there is no half-accepted state to re-enter.
- **The balance moved once.** `granted_at` is stamped before the mint and the mint carries a
  per-contribution idempotency key, so a retried review, a double-click, or a crash between the two
  cannot mint a second grant.
- No duplicated knowledge rows.

**Result:** web ☐

---

## CMC-A3 · Two members quoting the same passage do not duplicate it
**Role:** admin
**Steps:** Have two members contribute the exact same passage of text. Accept both.

**Expected:** One `comic_knowledge_entries` row, not two — `content_hash` uses the same formula as the
seed importer with ON CONFLICT DO NOTHING. Both contributions' entries point at that one row, so a
withdrawal by either still reaches it.

**Result:** web ☐

---

## CMC-A4 · Decline always carries a reason
**Role:** admin, then the contributor
**Steps:**
1. Press **Decline** with the reason box empty.
2. Fill a reason and decline.
3. Sign in as the contributor and open `/knowledge`.

**Expected:**
- Step 1 → refused, "Give a reason — the contributor sees it." A decline nobody can understand reads
  as a judgment on what they lived through.
- Step 3 → the contribution reads **Not used** with the reason shown. Nothing was promoted.

**Result:** web ☐

---

## CMC-A5 · The apps tile lands on the real page
**Role:** signed-in member
**Steps:** Open the apps launcher, find **Knowledge Library**, and tap it.

**Expected:** It lands on `/knowledge` — `/apps/knowledge` redirects there, so there is one page
rather than two copies to keep in step. The admin landing also lists **Contributed Writing** and
**AI Knowledge Base**.

**Result:** web ☐

---

## CMC-A6 · Knowledge-base curation: switch an entry off and on (added 2026-08-05)
**Role:** admin (plus a member session to check retrieval)
**Precondition:** at least one active `comic_knowledge_entries` row exists (accept a contribution via CMC-A1, or use seeded/imported entries).

**Steps:**
1. Open `/admin` and tap **AI Knowledge Base** (lands on `/admin/comic/knowledge`).
2. Read the list; use the `all` / `active` / `inactive` pills.
3. Switch one entry **off**, then ask the assistant a question whose only grounding is that entry.
4. Switch the same entry back **on**.
5. As a non-admin, open `/admin/comic/knowledge` directly and call `PUT /api/comic/admin/knowledge/<id>`.

**Expected:**
- Step 2: entries list newest-first with source, type, title/question, a content snippet, active state, and an "N of M entries active" summary; the pills filter and the counts follow.
- Step 3: the toggle saves without a page reload (the row shows "off" and dims); the assistant's draft for that question no longer quotes the switched-off entry (retrieval skips inactive rows). The row is NOT deleted.
- Step 4: the entry is active again and retrievable — off/on is reversible.
- Step 5: the page redirects the non-admin away, and the direct PUT is denied server-side (401/403); the PUT also requires the same-origin CSRF header.

**Result:** web ☐

---

## CMC-C5 · Withdrawal actually stops the assistant quoting you
**Role:** signed-in member (plus an admin to promote an entry, once the review surface ships)
**Steps:**
1. With an accepted contribution whose entries are in the knowledge base, ask the assistant something
   those entries answer, and confirm a draft is grounded in them (`comic_turns.grounding_entry_ids`).
2. On `/knowledge`, press **Withdraw** on that contribution.
3. Ask the same question again.

**Expected:**
- The contribution reads **Withdrawn**, and every `comic_knowledge_entries` row it produced has
  `active = FALSE`.
- The new draft is no longer grounded in those entries.
- Both changes happen together — there is no moment where the list says withdrawn while the
  assistant is still quoting it.

**Result:** web ☐

---

## CMC-C6 · You can only withdraw your own
**Role:** two signed-in members
**Steps:**
1. As member A, note a contribution id.
2. As member B, POST to `/api/comic/contributions/<A's id>/withdraw`.

**Expected:**
- 404, worded identically to a genuinely missing id — another member's contribution must not be
  distinguishable from one that does not exist.
- Member A's contribution is untouched.

**Result:** web ☐

---

## CMC-C7 · Deleting your account takes your writing with it
**Role:** a throwaway signed-in member
**Steps:**
1. Contribute an export, and (once the review surface ships) have it accepted so knowledge rows exist.
2. Delete the account from Account & Data.
3. In the database, look for that member's `comic_contributions`, `comic_contribution_entries`, and
   the `comic_knowledge_entries` rows carrying that `contribution_id`.

**Expected:**
- All three are gone. Account deletion **removes** the words, where Withdraw only deactivates them —
  deleting your account must never be a weaker promise than the button on the page.
- The owner's own seeded knowledge rows (`contribution_id` NULL) are untouched.
- The member's export under Account & Data included their contributions before deletion.

**Result:** web ☐

---

## CMC-C8 · Rate limit
**Role:** signed-in member
**Steps:** Send six exports within a day.

**Expected:** The sixth is refused with 429 and a plain message about trying again tomorrow. Parsing
an archive costs real memory, so an account cannot do it in a loop.

**Result:** web ☐
