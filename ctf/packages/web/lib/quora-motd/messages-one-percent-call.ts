import { motdArticleUrl, ONE_PERCENT_PAID_TIER_URL, type QuoraMotdMessage } from './types';

// Messages whose ask is the third Peace Battle 2 step: take your 1% further with One Percent, the
// paid tier. A call of up to half an hour, in the browser, with the owner, about the figure a trade
// produces and the first customer behind it. It costs $7 and needs no account.
//
// Every one of these says that the first two steps are complete without it and stay free. That
// line is not optional: a paid step that reads as the real one turns the free steps into a
// preview, and they are not.
//
// The Darn Tough figures are the ones Start with socks cites (a review published 15 December 2025),
// and the $142,500 average is Singapore's published output per worker. Nothing here projects this
// project's own growth.

export const QUORA_MOTD_ONE_PERCENT_CALL: QuoraMotdMessage[] = [
  {
    id: 'call-first-customer',
    action: 'one-percent-call',
    title: 'Every figure starts with one customer',
    body: [
      'Workforce shows what serving 50,000 people with your trade would be worth in a year. It does not tell you who the first one is.',
      'That is what One Percent is for: a call with me of up to half an hour, in your browser, about the figure your trade produces and the first customer behind it. It costs $7 and needs no account.',
      'Seeing your 1% and starting on the goal board are complete without it, and they stay free.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
  {
    id: 'call-free-steps-first',
    action: 'one-percent-call',
    title: 'The first two steps are free, and they are complete without the third',
    body: [
      'Peace Battle 2 has three steps. See your 1% in Workforce. Start on it on the goal board. Both are free and self-service, and they stay that way.',
      'The third is for somebody who wants to take it further: half an hour with me, in the browser, about your trade and its first customer, for $7, with no account.',
      'Nobody needs the third to have taken part.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('whats-your-one-percent'),
    ].join('\n\n'),
  },
  {
    id: 'call-socks',
    action: 'one-percent-call',
    title: 'A mill that lost its contracts bet on one sock',
    body: [
      'Cabot Hosiery Mills in Vermont made other companies\' socks for decades. In the early 2000s those contracts moved overseas and the business nearly collapsed.',
      'In 2004 it launched Darn Tough: one sock, guaranteed for life. It now sells over 5 million pairs a year and takes in more than $50 million.',
      'Your own trade runs on the same arithmetic. If you want half an hour on where yours starts, One Percent is $7 and needs no account. Seeing your 1% and the goal board stay free without it.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
  {
    id: 'call-smallest-version',
    action: 'one-percent-call',
    title: 'The smallest version is a living',
    body: [
      'People hear "one percent of five million" and picture a company. The smallest version of it is a living: enough customers in a year to keep one person housed and fed.',
      'Aiming for the smallest version and staying there is a complete answer. Nobody owes anybody a company.',
      'If you want help finding where yours starts, One Percent is half an hour with me for $7, no account. Seeing your figure and the goal board are free and stay free.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
  {
    id: 'call-7125-pairs',
    action: 'one-percent-call',
    title: '7,125 pairs of socks is one person in 700',
    body: [
      'The average contributor in What\'s Your 1% brings in $142,500 a year. At $20 a pair, that is 7,125 pairs of socks.',
      'In a population of five million, that is about one person in 700 buying one pair, once, in a year.',
      'Socks are one example. Your trade has its own version of that sum. One Percent is half an hour with me working it through, for $7, no account. The free steps are complete without it.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
  {
    id: 'call-ambitious-version',
    action: 'one-percent-call',
    title: 'The ambitious version is a company',
    body: [
      'At the top of the range sits a company the size of Darn Tough: over 300 people across three sites, more than 5 million pairs a year.',
      'Somebody can start at the average and decide later, or decide now, to aim at the top. Either is a real plan, and the arithmetic is the same at both ends.',
      'One Percent is half an hour with me about which end you are aiming at and the first customer either way. $7, no account. Seeing your 1% and the goal board stay free.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
  {
    id: 'call-nothing-offshore',
    action: 'one-percent-call',
    title: 'Nothing we make goes offshore',
    body: [
      'Darn Tough\'s turn came when its work moved overseas. For us that question is already settled. Targeted Individuals have been pushed out of the global economy, so there is no cheaper country to move the work to.',
      'What gets made here is made by people here, for people here.',
      'If you want half an hour on what you could make and who buys it first, One Percent is $7 with no account. The free steps are complete without it.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
  {
    id: 'call-not-a-forecast',
    action: 'one-percent-call',
    title: 'Arithmetic, not a forecast',
    body: [
      'Nothing on the 1% screen predicts anybody\'s income. It multiplies what you already charge one person by 50,000 of them. What actually happens takes talent, work and luck.',
      'What the arithmetic does is show the size of what one ordinary trade can reach. One Percent is half an hour with me on the first customer inside that figure, for $7, no account.',
      'Seeing the figure is free, and so is the goal board.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('whats-your-one-percent'),
    ].join('\n\n'),
  },
  {
    id: 'call-no-account',
    action: 'one-percent-call',
    title: 'Half an hour, in your browser, with no account',
    body: [
      'One Percent does not ask you to sign up for anything. It is a call of up to half an hour, it runs in your browser, and it costs $7.',
      'It is about one thing: the figure your trade produces and the first customer behind it.',
      'The two free steps of Peace Battle 2, seeing your 1% and starting on the goal board, are complete without it.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
  {
    id: 'call-everybody-uses',
    action: 'one-percent-call',
    title: 'Pick a product everybody already uses',
    body: [
      'Darn Tough did not invent a need. Everybody wears socks. It made one version good enough to guarantee for life.',
      'Most trades have a version of that: a thing people already buy, done well enough that they come back. Finding it is where a 1% starts.',
      'One Percent is half an hour with me on finding yours, for $7, with no account. Seeing your 1% and the goal board stay free.',
      'One Percent: ' + ONE_PERCENT_PAID_TIER_URL,
      'Full post: ' + motdArticleUrl('start-with-socks'),
    ].join('\n\n'),
  },
];
