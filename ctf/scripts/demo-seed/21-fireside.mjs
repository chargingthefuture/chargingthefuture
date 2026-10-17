// Fireside: a conversation under the blog's Dictionary post (the same post the fireside clips open)
// with two comments by the demo owner, a reply under the first one, a comment by a second member, and
// a reaction on the owner's first comment. That is the state FS-5 (a comment of your own on the
// Fireside screen), FS-6 (your comment with a reply under it) and FS-21 (a comment with a reply and a
// reaction, plus another member's comment in the same thread) start from.
//
// The second member is approved in Unlock, because Fireside shows a comment, reply or reaction to
// anybody but its author only when the author is approved. That one row in
// unlock_verification_submissions is the only write outside Fireside's own tables.
//
// The export columns (export_to_blog, export_review and the review fields) are never written: new
// rows take the defaults, which is "not requested", and a re-run leaves them as they are. Nothing in
// the demo schema is copied to the blog.
//
// The admin demo account gets the same conversation under a different post (OTHER_POST). Fireside
// shows every approved member's comment in a thread, so a second copy under Dictionary would put each
// line on that page twice for both accounts, and the clips find a comment by its exact words.
//
// A re-run puts the seeded comments' words back, marks them visible and unedited, and moves them back
// under their parents, so a clip that edits or takes one down can be recorded again.
const ID = {
  ownerComment: 'ddd00000-0000-4000-8210-000000000001',
  peerReply: 'ddd00000-0000-4000-8210-000000000002',
  peerComment: 'ddd00000-0000-4000-8210-000000000003',
  ownerSecond: 'ddd00000-0000-4000-8210-000000000004',
  reaction: 'ddd00000-0000-4000-8210-000000000005',
};

const PEER = 'demo-peer-fireside-01';
const PEER_NAME = 'rosa_delgado';

const THREAD_ID = 'ddd00000-0000-4000-8210-000000000010';

const POST = {
  repo: 'chargingthefuture/chargingthefuture',
  slug: 'Dictionary',
  title: 'Dictionary: Skills Economy Terms',
};

const OTHER_POST = {
  repo: 'chargingthefuture/chargingthefuture',
  slug: 'Call-to-Action',
  title: 'My call to action — Join the TI Skills Economy',
};

export default async function seed(client, ctx) {
  await client.query(
    `INSERT INTO unlock_verification_submissions
       (user_id, access_tier, review_status, quora_profile_url, quora_profile_url_normalized,
        unlock_window_expires_at, reviewed_by_user_id, reviewed_at)
     VALUES ($1, 'approved_full', 'approved', $2, $3, NOW() + INTERVAL '365 days', $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       access_tier = EXCLUDED.access_tier,
       review_status = EXCLUDED.review_status,
       updated_at = NOW()`,
    [PEER, `https://quora.com/profile/${PEER}`, `https://www.quora.com/profile/${PEER}`, ctx.ADMIN],
  );

  for (const account of ctx.PERSONAL_ACCOUNTS) {
    const post = account === ctx.OWNER ? POST : OTHER_POST;
    const mine = (ownerId) => ctx.personalId(account, ownerId);

    // The thread may already exist with a random id, made the first time somebody opened the post.
    const thread = await client.query(
      `INSERT INTO fireside_threads (id, post_repo, post_slug, post_title)
       VALUES ($4::uuid, $1, $2, $3)
       ON CONFLICT (post_repo, post_slug) DO UPDATE SET
         post_title = EXCLUDED.post_title,
         is_closed = FALSE,
         updated_at = NOW()
       RETURNING id`,
      [post.repo, post.slug, post.title, ctx.personalId(account, THREAD_ID)],
    );
    const threadId = thread.rows[0].id;

    // [id, parent id, author id, username, body, hours ago]
    const comments = [
      [mine(ID.ownerComment), null, account, '',
        'I keep this page open when I write to somebody new. The plain definitions save a lot of back and forth.', 72],
      [mine(ID.peerReply), mine(ID.ownerComment), PEER, PEER_NAME,
        'Same here. I sent the Directory entry to my sister last week and she understood it on the first read.', 48],
      [mine(ID.peerComment), null, PEER, PEER_NAME,
        'It would help to see the date each entry was last changed. The list at the top does some of that already.', 30],
      [mine(ID.ownerSecond), null, account, '',
        'The entry on recruited and signed up answered a question I had for weeks.', 20],
    ];

    for (const [id, parentId, authorId, username, body, hoursAgo] of comments) {
      await client.query(
        `INSERT INTO fireside_comments
           (id, thread_id, parent_comment_id, author_user_id, author_username, body, status, created_at, updated_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, 'visible',
                 NOW() - make_interval(hours => $7::int), NOW() - make_interval(hours => $7::int))
         ON CONFLICT (id) DO UPDATE SET
           thread_id = EXCLUDED.thread_id,
           parent_comment_id = EXCLUDED.parent_comment_id,
           author_user_id = EXCLUDED.author_user_id,
           author_username = EXCLUDED.author_username,
           body = EXCLUDED.body,
           status = 'visible',
           removed_by = NULL,
           removed_at = NULL,
           removal_reason = NULL,
           edited_at = NULL,
           withdrawn_body = NULL,
           created_at = EXCLUDED.created_at,
           updated_at = NOW()`,
        [id, threadId, parentId, authorId, username, body, hoursAgo],
      );
    }

    await client.query(
      `INSERT INTO fireside_reactions (id, comment_id, reactor_user_id, kind)
       VALUES ($1::uuid, $2::uuid, $3, 'recognize')
       ON CONFLICT (comment_id, reactor_user_id, kind) DO NOTHING`,
      [mine(ID.reaction), mine(ID.ownerComment), PEER],
    );
  }

  console.log(`  ✓ demo-seed fireside (4 comments, 1 reply, 1 reaction for each of ${ctx.PERSONAL_ACCOUNTS.length} account${ctx.PERSONAL_ACCOUNTS.length > 1 ? 's' : ''})`);
}
