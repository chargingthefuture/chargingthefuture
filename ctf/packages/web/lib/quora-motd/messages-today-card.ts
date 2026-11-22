import { TODAY_URL, motdArticleUrl, type QuoraMotdMessage } from './types';

// Messages whose ask is the first Enact step of Peace Battle 2: start on your 1% with an ask on
// Today. Put the part of the day that is left into one small task on somebody else's ask, and post
// an ask of your own. In 3.1 the goal board became Ask cards on Today (owner report, 2026-11-22:
// the rotation still named the board), so these name Today, the ask and its small tasks, and no
// part of the app by its old name.
//
// Every fact here is how an ask works as shipped: + New posts an ask and can break it into up to 30
// small tasks, each small enough to do from a phone in under half an hour; a task held a day
// without a result goes back by itself; the person who asked marks whether it helped; a card has
// no group chat and no direct messages, only its own conversation, public to start, with I can help
// and I know someone; the viewer's own ask shows how many of its tasks are taken; and writing in a
// card is open from sign-in, pausing after day 14 until Unlock is done unless the address was sent
// or help was asked for (lib/today/cards/access.ts). If any of that changes, these change with it.
//
// The order matches the pool it replaced one for one, so the rotation shows the same slot on the
// same day.

export const QUORA_MOTD_TODAY_CARD: QuoraMotdMessage[] = [
  {
    id: 'today-leftover-day',
    action: 'today-card',
    title: 'Nobody here gets a full day',
    body: [
      'Most of a Targeted Individual\'s day goes to the attacks and to what they force. What is left is small, and it is not enough to reach a goal alone, because a goal is a chain of steps and the attacks land on the chain.',
      'It is enough when it is not all one person\'s. An ask on Today can be broken into small tasks, each one small enough to do from a phone in under half an hour, and anybody can take one.',
      'Put the part of today that is left into one small task on somebody else\'s ask: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-room-anybody',
    action: 'today-card',
    title: '"Help me find a room" is an ask anybody can answer',
    body: [
      'A marketplace looks empty until both sides have arrived. Somebody looking for a room finds no listings, closes the app, and does not come back.',
      'An ask on Today does not wait for that. A small task like "find two people who list a room near me" needs nobody with a room to be signed up yet. It needs somebody with a phone and half an hour.',
      'Take one small task, or post the ask you need help with: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-finish-line',
    action: 'today-card',
    title: 'An ask needs a finish line',
    body: [
      '"Get stable" is not a goal anybody can help with. "Get a forklift certificate" is, because everybody can tell when it is done.',
      'On Today you post an ask with a finish line and break it into small tasks: find three places that run the class on weekends, find out which warehouses pay for it once they hire you. When it is done, you mark it reached.',
      'Post yours: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-one-task-plenty',
    action: 'today-card',
    title: 'One small task is plenty',
    body: [
      'Nobody is asked to join a project, attend a meeting, or commit to anything past today.',
      'Pick one small task on somebody else\'s ask. Do it from your phone. Post what you found. That is the step, and it is complete on its own.',
      'The person who asked sees it on their own card on Today, which shows how many of its small tasks have been taken.',
      'Pick one: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-no-group-chat',
    action: 'today-card',
    title: 'No group chat, on purpose',
    body: [
      'Today has no group chat and no direct messages. Each ask carries its own conversation about that ask, public to start, and quick answers in place of most comments: I can help, I know someone.',
      'Nobody has to explain their situation, prove anything, or keep up with a thread to help. A private conversation opens only after both people agree to it.',
      'Answer one ask: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-task-goes-back',
    action: 'today-card',
    title: 'A small task you could not finish goes back by itself',
    body: [
      'Days here do not go to plan. Somebody takes a small task in the morning and by the afternoon the day has been taken from them.',
      'So nothing chases you. A task held for a day without a result goes back on its own, and somebody else can pick it up. Taking one costs nothing if the day goes wrong.',
      'Take one anyway: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-it-helped',
    action: 'today-card',
    title: 'The person who asked says whether it helped',
    body: [
      'When you post what you found, the person who asked marks it: it helped, keep it, or send it back.',
      'Nobody else scores your work, and there is no number on anybody. A task that helped counts toward a badge, Weavers of the Commons, and that is the only thing it counts toward.',
      'Help with one small task today: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-three-numbers',
    action: 'today-card',
    title: 'Find three numbers, make one call, look up one listing',
    body: [
      'That is the size of a small task. Not a plan, not a campaign. Three phone numbers for yards that are hiring. One call to ask whether a clinic takes walk-ins. One listing checked to see if it is still open.',
      'Each one is a step somebody else could not take today, and you can take it in the time a bus ride lasts.',
      'Pick a small task: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-adds-up',
    action: 'today-card',
    title: 'Other people\'s leftover time adds up for you',
    body: [
      'Post an ask of your own, broken into small tasks somebody could do from a phone.',
      'You will not get anybody\'s full day either. You will get the half hour somebody had left, and somebody else\'s half hour after that, and a chain of steps that would have stalled with one person gets finished by several.',
      'Post your ask: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('one-small-task-on-today'),
    ].join('\n\n'),
  },
  {
    id: 'today-open-from-sign-in',
    action: 'today-card',
    title: 'Answering an ask is open from the day you sign in',
    body: [
      'Writing in a card on Today is open from the first day. After two weeks it waits on the check, unless you have already sent the address for it or asked for help finding it.',
      'The check is the web address of your own Quora profile, and a person reads it. There is no interview and no form about your history. Nobody is removed for being slow with it.',
      'Start on Today: ' + TODAY_URL,
      'Full post: ' + motdArticleUrl('new-here-three-things-to-do-first'),
    ].join('\n\n'),
  },
];
