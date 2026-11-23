// WhatWorks demo data for the paging case (WW-7): eight more active problems on top of the three
// seedDemo.mjs writes, so the member list runs to three pages of five. Each problem carries approved
// tools with a few helpful marks from synthetic members, and one carries four tools so its card
// shows the "Show N more tools" control on page 2 as well.
const PEOPLE = (ctx) => [ctx.PEER_1, ctx.PEER_2, ctx.ADMIN, ctx.HOST, ctx.TRAINER];

const id = (n) => `ddd00000-0000-4000-8410-0000000000${n.toString(16).padStart(2, '0')}`;

// [slug, emoji, title, context, [[emoji, name, kind, note, helpful], ...]]. Each problem reads like a
// question somebody would post: the specific problem, then what they already tried.
const PROBLEMS = [
  ['door-security', '🚪', 'How do I keep a rented room door shut at night when I cannot change the lock?',
    'The landlord keeps a key and the chain is broken. A chair under the handle slides on the tile floor.',
    [
      ['🔔', 'Door stop alarm', 'Wedge with a loud alarm', 'Slides under the door at night. Goes off if anyone pushes it open.', 4],
      ['🔒', 'Portable door lock', 'Travel lock, no tools', 'Works in rentals and hotel rooms. Nothing to install, nothing left behind.', 3],
    ]],
  ['phone-privacy', '📱', 'People next to me on the bus read my phone screen. How do I stop that?',
    'Turning the brightness down and holding the phone close did not stop it. My laptop camera light also came on once when I was not using it.',
    [
      ['🕶️', 'Privacy screen protector', 'Side-angle filter', 'People next to you on the bus see a dark screen.', 3],
      ['📷', 'Webcam cover slide', 'Thin sliding cover', 'Sticks on and slides open when you need the camera.', 2],
    ]],
  ['keeping-records', '📓', 'How do I keep incident notes that nobody can quietly change?',
    'I kept notes in a phone app, and entries changed and dates moved without my doing it. I need a record where a change shows.',
    [
      ['📓', 'Bound notebook', 'Numbered pages', 'Pages cannot be torn out without it showing. Date every entry.', 4],
      ['🖊️', 'Gel pens, waterproof', 'Smear-proof ink', 'Ink that survives a spilled drink or a wet bag.', 2],
    ]],
  ['charging-away-from-home', '🔋', 'My phone dies by mid-afternoon when I am out all day. What keeps it charged?',
    'Battery saver and closing apps buy an hour at most. Library outlets are far from the tables and my cable does not reach.',
    [
      ['🔋', 'Power bank, 10,000 mAh', 'Pocket battery', 'Two full phone charges. Small enough for a jacket pocket.', 5],
      ['🔌', 'Two-port wall charger', 'USB-C and USB-A', 'Charges the phone and the power bank at the same outlet.', 3],
      ['🧵', 'Braided charging cable', 'Six feet long', 'Reaches from a library outlet to the table. Lasts longer than the thin ones.', 2],
      ['☀️', 'Folding solar panel', 'Small USB panel', 'Slow, but it works on a sunny day with no outlet at all.', 1],
    ]],
  ['cold-nights', '🧦', 'The heat goes off at night in my building. How do I stay warm in bed?',
    'Two blankets and cotton socks still leave my feet cold by 2 AM, and the blankets feel damp by morning.',
    [
      ['🧦', 'Wool socks', 'Thick, merino blend', 'Warm even when damp. The first thing to buy for winter.', 4],
      ['🛌', 'Fleece sleeping bag liner', 'Light extra layer', 'Adds warmth under a blanket and packs into a small bag.', 2],
    ]],
  ['mail-and-packages', '📬', 'My letters go missing or arrive opened. How do I keep my mail safe?',
    'The building has an open shared mailbox. I asked the carrier and filed a complaint, and it still happens about once a week.',
    [
      ['📬', 'Locking mailbox', 'Wall or post mount', 'Only the key opens it. Letters stopped going missing.', 3],
      ['🏤', 'Post office box', 'Rented box at the post office', 'A steady address that does not change when you move.', 3],
    ]],
  ['food-on-the-go', '🥪', 'How do I keep a packed lunch good to eat when I am out from morning to evening?',
    'Food packed in a plastic bag is warm by noon, so I end up buying something on the way instead.',
    [
      ['🧊', 'Insulated lunch bag', 'Soft cooler with ice pack', 'Keeps a packed meal cold until the afternoon.', 3],
      ['🥣', 'Collapsible bowl and spork', 'Silicone, folds flat', 'Fits in a bag. Easy to rinse anywhere.', 2],
    ]],
  ['laundry-without-a-machine', '🧺', 'How do I wash clothes at home without a washing machine?',
    'The laundromat is far and not safe to wait in. Washing by hand in the sink takes an hour and the clothes stay wet for two days.',
    [
      ['🪣', 'Hand wash plunger', 'Bucket washer', 'A bucket and this get a load clean in ten minutes.', 2],
      ['🧺', 'Folding drying rack', 'Indoor rack', 'Dries a load overnight in a small room.', 2],
    ]],
];

export default async function seed(client, ctx) {
  const people = PEOPLE(ctx);
  let n = 1;
  for (const [index, [slug, emoji, title, context, products]] of PROBLEMS.entries()) {
    // Sort after the three base problems (0-2), so pages 2 and 3 are these.
    const problemRes = await client.query(
      `INSERT INTO what_works_problems (id, slug, emoji, title, context, sort_order, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
       ON CONFLICT (slug) DO UPDATE SET
         emoji = EXCLUDED.emoji, title = EXCLUDED.title, context = EXCLUDED.context,
         sort_order = EXCLUDED.sort_order, is_active = TRUE, updated_at = NOW()
       RETURNING id`,
      [id(n), slug, emoji, title, context, 10 + index, ctx.ADMIN],
    );
    n += 1;
    const problemId = problemRes.rows[0].id;

    for (const [pIndex, [pEmoji, name, kind, note, helpful]] of products.entries()) {
      const productId = id(n);
      n += 1;
      // created_at is spaced out so the card lists the tools in the order written here.
      await client.query(
        `INSERT INTO what_works_products
           (id, problem_id, emoji, name, kind, note, purchase_url, status, suggested_by, reviewed_by, reviewed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', $8, $9, NOW(), NOW() - ($10::int * INTERVAL '1 minute'))
         ON CONFLICT (id) DO UPDATE SET
           problem_id = EXCLUDED.problem_id, emoji = EXCLUDED.emoji, name = EXCLUDED.name, kind = EXCLUDED.kind,
           note = EXCLUDED.note, purchase_url = EXCLUDED.purchase_url, status = 'approved',
           rejection_reason = NULL, created_at = EXCLUDED.created_at, updated_at = NOW()`,
        [productId, problemId, pEmoji, name, kind, note, `https://duckduckgo.com/?q=${encodeURIComponent(name)}`,
          people[pIndex % people.length], ctx.ADMIN, 100 - pIndex],
      );
      // Helpful marks from synthetic members only, so the recording account can still mark one.
      await client.query('DELETE FROM what_works_endorsements WHERE product_id = $1', [productId]);
      for (const userId of people.slice(0, helpful)) {
        await client.query(
          `INSERT INTO what_works_endorsements (product_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (product_id, user_id) DO NOTHING`,
          [productId, userId],
        );
      }
    }
  }
}
