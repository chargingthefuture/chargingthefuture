import { GOAL_BOARD_URL, motdArticleUrl, type QuoraMotdMessage } from './types';

// Messages whose ask is the second Peace Battle 2 step: start on your 1% on the PeerProgramming
// goal board. Put the part of the day that is left into one card on somebody else's goal, and post
// a goal of your own.
//
// Every fact here is how the board works as shipped: one open goal per member, cards small enough
// to do from a phone in under half an hour, a card held a day without a result going back by
// itself, the goal's owner marking whether it helped, and an approved account to take part. If the
// board changes, these change with it.

export const QUORA_MOTD_GOAL_BOARD: QuoraMotdMessage[] = [
  {
    id: 'goal-leftover-day',
    action: 'goal-board',
    title: 'Nobody here gets a full day',
    body: [
      'Most of a Targeted Individual\'s day goes to the attacks and to what they force. What is left is small, and it is not enough to reach a goal alone, because a goal is a chain of steps and the attacks land on the chain.',
      'It is enough when it is not all one person\'s. The goal board breaks each goal into cards small enough to do from a phone in under half an hour, and anybody can take one.',
      'Put the part of today that is left into one card on somebody else\'s goal: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-room-anybody',
    action: 'goal-board',
    title: '"Help me find a room" is a card anybody can answer',
    body: [
      'A marketplace looks empty until both sides have arrived. Somebody looking for a room finds no listings, closes the app, and does not come back.',
      'The goal board does not wait for that. A card like "find two people who list a room near me" needs nobody with a room to be signed up yet. It needs somebody with a phone and half an hour.',
      'Take one card, or post the goal you need help with: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-finish-line',
    action: 'goal-board',
    title: 'A goal needs a finish line',
    body: [
      '"Get stable" is not a goal anybody can help with. "Get a forklift certificate" is, because everybody can tell when it is done.',
      'On the goal board you post one goal at a time, with a finish line, and break it into cards: find three places that run the class on weekends, find out which warehouses pay for it once they hire you. When it is done, you mark it reached.',
      'Post yours: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-one-card-plenty',
    action: 'goal-board',
    title: 'One card is plenty',
    body: [
      'Nobody is asked to join a project, attend a meeting, or commit to anything past today.',
      'Pick one card from somebody else\'s goal. Do it from your phone. Post what you found. That is the step, and it is complete on its own.',
      'The board shows how many cards everybody finished in the last day, so one card is something other people can see happened.',
      'Pick one: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-no-conversation',
    action: 'goal-board',
    title: 'There is no conversation on the board, on purpose',
    body: [
      'A goal, its cards, and what somebody found. That is all the board holds.',
      'Nobody has to explain their situation, prove anything, or keep up with a thread to help. The chat and the calls are next door in PeerProgramming for anybody who wants them, and the board works without them.',
      'Take a card: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-card-goes-back',
    action: 'goal-board',
    title: 'A card you could not finish goes back by itself',
    body: [
      'Days here do not go to plan. Somebody takes a card in the morning and by the afternoon the day has been taken from them.',
      'So nothing chases you. A card held for a day without a result goes back to the list on its own, and somebody else can pick it up. Taking a card costs nothing if the day goes wrong.',
      'Take one anyway: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-it-helped',
    action: 'goal-board',
    title: 'The person whose goal it is says whether it helped',
    body: [
      'When you post what you found, the owner of the goal marks it: it helped, keep it, or send it back.',
      'Nobody else scores your work, and there is no number on anybody. A card that helped counts toward a badge, Weavers of the Commons, and that is the only thing it counts toward.',
      'Help with one card today: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-three-numbers',
    action: 'goal-board',
    title: 'Find three numbers, make one call, look up one listing',
    body: [
      'That is the size of a card. Not a plan, not a campaign. Three phone numbers for yards that are hiring. One call to ask whether a clinic takes walk-ins. One listing checked to see if it is still open.',
      'Each one is a step somebody else could not take today, and you can take it in the time a bus ride lasts.',
      'Pick a card: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-adds-up',
    action: 'goal-board',
    title: 'Other people\'s leftover time adds up for you',
    body: [
      'Post a goal of your own, with cards somebody could do from a phone.',
      'You will not get anybody\'s full day either. You will get the half hour somebody had left, and somebody else\'s half hour after that, and a chain of steps that would have stalled with one person gets finished by several.',
      'Post your goal: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('show-up-with-your-percent'),
    ].join('\n\n'),
  },
  {
    id: 'goal-approved',
    action: 'goal-board',
    title: 'The board takes an approved account, and the check is a person reading a public page',
    body: [
      'To take part you send the web address of your own Quora profile, and a person reads it. There is no interview and no form about your history.',
      'Nobody is removed for being slow with it, or for asking for help finding the address. While you wait you can still write, and what you write goes into the same queue as your check.',
      'Once you are in, the board is the first place to go: ' + GOAL_BOARD_URL,
      'Full post: ' + motdArticleUrl('new-here-three-things-to-do-first'),
    ].join('\n\n'),
  },
];
