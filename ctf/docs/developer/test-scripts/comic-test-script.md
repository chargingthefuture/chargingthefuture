# AI Assistant (@comic) — Manual Test Script

Covers the member-facing contribute surface. The `@comic` question/answer flow and the admin review
dashboard are exercised through the feed test script and the admin walkthroughs; this file starts
with the contribution intake because its promises are ones a member is asked to trust before they
hand over anything.

**Read this first:** most of what follows is checking that something did *not* happen — that a
private section was dropped, that a file was not kept, that a refusal came before a read. Those are
the tests worth running slowly.

---

## CMC-C0 · An unverified member cannot get in
**Role:** signed-in member who has NOT completed Unlock
**Steps:**
1. Open `/knowledge`.
2. Signed out entirely, open `/knowledge`.

**Expected:**
- Step 1 → redirected to `/plugin/unlock`, **not** to sign-in. They are already signed in; telling
  them to sign in again would explain nothing. They must never reach the form and fill it in only to
  be refused on send (that mismatch was the 2026-07-29 fix).
- Step 2 → redirected to sign-in.
- `POST /api/comic/contributions` called directly by an unverified member → 403 `unlock_required`.

**Result:** web ☐

---

## CMC-C1 · Pick a few posts (the default path)
**Role:** verified member (Unlock complete) · **Surfaces:** web + mobile-responsive
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
  answer from." (Not a quality judgement — the reviewer would only discard it, so saying so now saves
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

## CMC-A1 · Review: accept, and the credits
**Role:** admin, plus a verified contributor
**Steps:**
1. Have the contributor send a contribution from `/knowledge`.
2. Open `/admin/comic/contributions`.
3. Press **Leave out** on one entry, then press it again and confirm it toggles back with **Put back**.
4. Press **Accept N of M**.
5. Check `comic_knowledge_entries` and the contributor's ServiceCredits balance.

**Expected:**
- Every entry is shown **in full**, not summarised — the decision cannot be made from a count.
- Nothing is excluded by default: entries start included and the reviewer opts one OUT. A skim must
  not be able to silently drop someone's writing.
- If the contributor wrote a third-party note, it appears **at the top of the card**, highlighted —
  that is the thing to check before promoting anything.
- After step 4: the left-out entry is **not** in `comic_knowledge_entries`; the kept ones are, each
  carrying `contribution_id`. The screen says how many were added and that the credits were granted,
  and `granted_at` is set.
- The "no credits — not verified yet" branch is **unreachable** now that contributing requires Unlock
  (CMC-C0). It is kept as the last gate before a mint; there is nothing to test by hand.

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
  as a judgement on what they lived through.
- Step 3 → the contribution reads **Not used** with the reason shown. Nothing was promoted.

**Result:** web ☐

---

## CMC-A5 · The apps tile lands on the real page
**Role:** signed-in member
**Steps:** Open the apps launcher, find **Knowledge Library**, and tap it.

**Expected:** It lands on `/knowledge` — `/apps/knowledge` redirects there, so there is one page
rather than two copies to keep in step. The admin landing also lists **Contributed Writing**.

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
