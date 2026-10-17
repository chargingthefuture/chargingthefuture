// Commons (Feed & Announcements): posts by other members and one official announcement, so the
// reply, quoted-reply and reaction cases (feed test script FD-10, FD-11, FD-14) have something to
// act on. Three synthetic members post in the last hour; one post quotes another; one post and the
// announcement already carry a reaction from somebody else. The first post has no reactions at all,
// so a member's first thumbs-up on it reads as a count of 1.
//
// Every row is written with its feed_items copy and a feed_item_targets row, because the Commons
// timeline only shows an item that has a target the viewer's role matches. A re-run moves the posts
// back to the last hour and removes any reaction the demo owner left on them, so the toggle case
// starts from the same state every time.
const ID = {
  post1: 'ddd00000-0000-4000-8200-000000000001',
  post2: 'ddd00000-0000-4000-8200-000000000002',
  post3: 'ddd00000-0000-4000-8200-000000000003',
  announcement: 'ddd00000-0000-4000-8200-000000000004',
  announcementItem: 'ddd00000-0000-4000-8200-000000000005',
  post1Item: 'ddd00000-0000-4000-8200-000000000006',
  post2Item: 'ddd00000-0000-4000-8200-000000000007',
  post3Item: 'ddd00000-0000-4000-8200-000000000008',
  post2Reaction: 'ddd00000-0000-4000-8200-000000000009',
  announcementReaction: 'ddd00000-0000-4000-8200-00000000000a',
};

const DAN = 'demo-peer-commons-01';
const MARIA = 'demo-peer-commons-02';
const JUNE = 'demo-peer-commons-03';

// [post id, feed item id, author id, username, body, minutes ago, quoted post id]
const POSTS = [
  [ID.post1, ID.post1Item, DAN, 'dan_whitaker',
    'Does anybody know a laundromat near the bus station that stays open late? Mine closes at 8.', 50, null],
  [ID.post2, ID.post2Item, MARIA, 'maria_lopez',
    'I put a small task on the PeerProgramming goal board: help me sort my work history into skills. Ten minutes is plenty if anybody has them.', 40, null],
  [ID.post3, ID.post3Item, JUNE, 'june_park',
    'The one on Fifth Street is open until 11. The card reader there was broken last week, so bring quarters.', 30, ID.post1],
];

const ANNOUNCEMENT_TITLE = 'Small tasks on the goal board';
const ANNOUNCEMENT_BODY =
  'The PeerProgramming goal board takes small tasks. Post one toward your own goal, or pick up a few minutes of somebody else\'s.';

async function upsertFeedItem(client, row) {
  const { id, itemType, sourceColumn, sourceId, title, body, minutesAgo, authorId, role } = row;
  await client.query(
    `INSERT INTO feed_items
       (id, item_type, ${sourceColumn}, title, body, published_at, is_active, created_by_user_id, updated_by_user_id)
     VALUES ($1::uuid, $2, $3::uuid, $4, $5, NOW() - make_interval(mins => $6::int), TRUE, $7, $7)
     ON CONFLICT (id) DO UPDATE SET
       item_type = EXCLUDED.item_type,
       title = EXCLUDED.title,
       body = EXCLUDED.body,
       published_at = EXCLUDED.published_at,
       expires_at = NULL,
       is_active = TRUE,
       updated_at = NOW()`,
    [id, itemType, sourceId, title, body, minutesAgo, authorId],
  );
  await client.query(
    `INSERT INTO feed_item_targets (item_id, target_role, target_plugin, target_region)
     VALUES ($1::uuid, $2, NULL, NULL)
     ON CONFLICT (item_id, target_role, target_plugin, target_region) DO NOTHING`,
    [id, role],
  );
}

export default async function seed(client, ctx) {
  for (const [postId, itemId, authorId, username, body, minutesAgo, quotedId] of POSTS) {
    await client.query(
      `INSERT INTO feed_community_posts
         (id, author_user_id, author_username, body, category, moderation_status, reply_count, reply_to_post_id, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, 'general', 'accepted', 0, $5::uuid, NOW() - make_interval(mins => $6::int), NOW())
       ON CONFLICT (id) DO UPDATE SET
         author_user_id = EXCLUDED.author_user_id,
         author_username = EXCLUDED.author_username,
         body = EXCLUDED.body,
         category = EXCLUDED.category,
         moderation_status = 'accepted',
         reply_to_post_id = EXCLUDED.reply_to_post_id,
         edited_at = NULL,
         created_at = EXCLUDED.created_at,
         updated_at = NOW()`,
      [postId, authorId, username, body, quotedId, minutesAgo],
    );
    await upsertFeedItem(client, {
      id: itemId,
      itemType: 'community',
      sourceColumn: 'source_community_post_id',
      sourceId: postId,
      title: 'general update',
      body,
      minutesAgo,
      authorId,
      role: 'member',
    });
  }

  await client.query(
    `INSERT INTO announcements
       (id, title, body, status, published_at, targeting, created_by_user_id, updated_by_user_id, linked_plugin_slugs)
     VALUES ($1::uuid, $2, $3, 'published', NOW() - INTERVAL '2 hours', '{}'::jsonb, $4, $4, '[]'::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       body = EXCLUDED.body,
       status = 'published',
       published_at = EXCLUDED.published_at,
       expires_at = NULL,
       updated_at = NOW()`,
    [ID.announcement, ANNOUNCEMENT_TITLE, ANNOUNCEMENT_BODY, ctx.ADMIN],
  );
  await upsertFeedItem(client, {
    id: ID.announcementItem,
    itemType: 'announcement',
    sourceColumn: 'source_announcement_id',
    sourceId: ID.announcement,
    title: ANNOUNCEMENT_TITLE,
    body: ANNOUNCEMENT_BODY,
    minutesAgo: 120,
    authorId: ctx.ADMIN,
    role: 'member',
  });

  // Reactions from other members, so a chip is already there to read.
  await client.query(
    `INSERT INTO feed_community_post_reactions (id, post_id, user_id, emoji)
     VALUES ($1::uuid, $2::uuid, $3, '❤️')
     ON CONFLICT (post_id, user_id, emoji) DO NOTHING`,
    [ID.post2Reaction, ID.post2, JUNE],
  );
  await client.query(
    `INSERT INTO announcement_reactions (id, announcement_id, user_id, emoji)
     VALUES ($1::uuid, $2::uuid, $3, '👍')
     ON CONFLICT (id) DO NOTHING`,
    [ID.announcementReaction, ID.announcement, MARIA],
  );

  // Anything the demo accounts reacted with last time comes off, so FD-14 starts from no reaction.
  await client.query(
    `DELETE FROM feed_community_post_reactions
      WHERE post_id = ANY($1::uuid[]) AND user_id = ANY($2::text[])`,
    [[ID.post1, ID.post2, ID.post3], ctx.REAL_USERS],
  );
  await client.query(
    `DELETE FROM announcement_reactions
      WHERE announcement_id = $1::uuid AND user_id = ANY($2::text[])`,
    [ID.announcement, ctx.REAL_USERS],
  );

  console.log('  ✓ demo-seed commons (3 member posts, 1 announcement)');
}
