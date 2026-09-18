import { motdArticleUrl, type QuoraMotdMessage } from './types';

// Messages whose ask is the first Peace Battle 2 action: leave a comment under a post on the blog.
// Reading the conversation needs no account, so this is the action with the lowest bar of the
// three — which is why it carries the messages aimed at somebody arriving for the first time.

export const QUORA_MOTD_FIRESIDE: QuoraMotdMessage[] = [
  {
    id: 'fireside-address',
    action: 'fireside',
    title: 'Your comment on my post died with my account, and you did nothing wrong',
    body: [
      'Quora has erased my accounts forty-seven times. Each time, every comment underneath went with it — mine and everybody else\'s. If you replied to me there and cannot find what you wrote, that is why.',
      'One of those handles was banned inside the same minute it was opened. Another lasted thirty-three minutes. Nobody read the posts in that time, which tells you the decision was about the account, not about anything written.',
      'A comment is worth more than that. There is now a conversation under every post on my blog, called Fireside. Reading it needs no account at all — no sign-in, no box asking you to create something before you are allowed to see what people said. Writing takes a free account, and what you write becomes publicly visible once you are approved.',
      'A comment there has an address. It can be linked, found again, and it is still there next year.',
      'Read any post and say something under it.',
      'Full post: ' + motdArticleUrl('you-can-talk-under-these-posts-now'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-nothing-ranked',
    action: 'fireside',
    title: 'Nothing on my blog decides what you get to read',
    body: [
      'Comments under my posts run oldest first, and that is the only order there is.',
      'You can agree with a comment. The number beside it changes and nothing else does — it does not move up, and nothing anywhere reads a count to decide what gets seen. Disagree is recorded and shown to nobody, because what it should do is not decided yet and a number on a screen would decide it by accident.',
      'That is the inversion of the platform I am writing this on. Here, what is read is what was voted on. There, what is read is what was written, in the order people wrote it.',
      'Three reactions rather than open emoji — I recognize this, This helped, Same here — so a count means the same thing on every comment. Replies go one level deep, because deeper is unreadable on a phone.',
      'Reading it needs no account. Go and read a thread, and leave a comment if you have one.',
      'Full post: ' + motdArticleUrl('you-can-talk-under-these-posts-now'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-take-it-down',
    action: 'fireside',
    title: 'You can take your own words down, and no admin is involved',
    body: [
      'A fair question about writing anything anywhere: what happens when I want it gone.',
      'On the conversation under my blog posts, you take your own comment down yourself, at any time, with no admin involved and no reason required. The words go from the thread. You keep your own copy, shown to you and to nobody else, because the moment somebody most needs to read what they wrote is just after they have destroyed it. Deleting your account takes your comments with it.',
      'One exception, and it is worth reading twice. A comment can be copied into the blog\'s own published pages, which web archives capture and which nobody — me included — can pull back afterwards. That takes two separate yeses: you ask, and an admin agrees. Neither does anything alone, and you can take the ask back at any point before the copy is made.',
      'Nothing else can happen to something you write there. Read any post and say something under it.',
      'Full post: ' + motdArticleUrl('you-can-talk-under-these-posts-now'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-shielding-knowledge',
    action: 'fireside',
    title: 'Somebody spent years and several hundred dollars learning that, and a deleted post takes it',
    body: [
      'Gn0b0dy Pneuma (https://www.quora.com/profile/Gn0b0dy-Pneuma) wrote out what they learned buying shielding fabric and building faraday cages: that a cheap grounding wire helped, that whether your skin should touch the material depends on the frequency, that a cage with a gap in it behaves differently at different frequencies, and that several hundred dollars of silver body suit did not work and did not last.',
      'That is years of somebody\'s money and attention, written out for strangers. It was sitting in a comment. When one of my posts here is deleted, the comments under it go too — so twenty minutes of somebody else\'s writing dies for a reason that has nothing to do with them.',
      'What Works is one shared list organized by the problem rather than the person, and survivor-verified there means something narrower than it sounds: one named person bought it and says it helped. Not that it works.',
      'If you have learned something the hard way, put it somewhere it survives. Say it under a post on my blog — reading the conversation needs no account.',
      'Full post: ' + motdArticleUrl('what-works-knowledge-that-survives-a-ban'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-record-forwards',
    action: 'fireside',
    title: 'Consistency is the one credential nobody can fake backwards',
    body: [
      'There is a page on my blog called The Record. The feed runs newest first and answers what is being said now. The Record runs oldest first and answers how long it has been said.',
      'It holds the writing I scattered across this platform on other people\'s pages — answers under their questions, comments under their answers, submissions to their spaces. When I published it, it counted 632 entries, under 149 different questions, across 48 spaces, spanning 22 months.',
      'That kind of writing never reads as a body of work while it is happening. Each piece sits alone under somebody else\'s question. Put back in order, it is one thing.',
      'Every original address on it prints as plain text and never as a link, because every one of them is dead. The accounts that held that writing were destroyed, and the entries continue past each takedown.',
      'A new account takes an afternoon. Twenty-two months of dated entries does not. If you are writing somewhere it can be erased, start putting it somewhere it cannot — you can start by saying something under a post on my blog.',
      'Full post: ' + motdArticleUrl('the-record-reads-forwards'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-check-me',
    action: 'fireside',
    title: 'How to check me, ordered by how little you have to trust me',
    body: [
      'Somebody said they would pass my writing on once they had done their fact check. That is the right instinct, so here is how.',
      'Every post on my blog is a plain text file stored publicly, and every change to one is recorded and dated — not only when it was published, but the day a word in it changed three days later, and which word. Nothing can be altered quietly, because an edit records itself.',
      'The app is a public repository too, so a claim about what it does can be read against the code that does it. Every time the blog publishes, the changed pages go to the Internet Archive, so copies exist that I did not make and cannot alter. And the feed numbers every post by publication order, so a removal would leave a hole and a backdated post would land out of sequence.',
      'What none of that gets you is proof that anything I describe happened. A timestamp shows when something was written, not that it is true. I would rather say that than let the machinery imply otherwise.',
      'Check it, then tell me where I am wrong under the post. Reading the conversation needs no account.',
      'Full post: ' + motdArticleUrl('how-to-check-me'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-smear',
    action: 'fireside',
    title: 'You cannot argue a smear down',
    body: [
      'A smear is not an argument. It is not offered so it can be examined — it is offered so it can be repeated, and it is built unfalsifiable on purpose: vague enough that nothing you produce settles it, specific enough to embarrass, always attached to somebody who will not say who told them.',
      'So replying does nothing except say the thing again in your own voice, put you in the frame as the person the accusation is about, and take the day. Those costs are not a side effect. The rebuttal is what the narrative is being spent on.',
      'What does work is the thing a smear cannot touch: a record with dates on it, and people who have seen you do something real.',
      'If somebody has built one around you, say so under the post. Reading the conversation needs no account, and what you write becomes visible once you are approved.',
      'Full post: ' + motdArticleUrl('you-cannot-argue-a-smear-down'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-platform-first',
    action: 'fireside',
    title: 'Nothing is written on a platform first anymore',
    body: [
      'The third deletion took two years of connections with it. What I lost was not the writing — I can rewrite a post. It was people knowing who I am.',
      'So the arrangement changed. Everything I publish starts on my own blog. Platforms get a short version and a link back, never the original. One page always carries whichever handle is current, and when the next account goes, the cost is one line moving from the live list to the dead list.',
      'This post is that arrangement working. You are reading a summary. The writing is somewhere that does not depend on this account still existing tomorrow.',
      'The conversation is there too, under each post, and reading it needs no account. Say something under one.',
      'Full post: ' + motdArticleUrl('deplatformed-keep-your-people'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-project-dead',
    action: 'fireside',
    title: 'A person who finds an app empty does not book a call to report it',
    body: [
      'Somebody on the app called me to say it is dead, nobody is on it, and they are getting no value from it. In the same conversation they asked me to ask them to stay, and then asked for advanced permissions so they could help bring more people in. They have brought nobody.',
      'Take the first part alone and it does not hold: a person who finds an app empty and useless stops opening it. The second part gives the first away, because there is nothing to be asked to stay for in a place you have just called dead. The third says what the first two were for.',
      'There are no advanced permissions in the app to give. One thing happens between two members: material value. A ride, a repair, a place to stay, an hour of a trade you do not have. It is arranged between the two people, both come away with something real, and then it is finished. There is no staff to get to, no ads to buy, and no feed to place anything in.',
      'If you think it is dead, say that under the post rather than to me on a call. Reading the conversation needs no account, and I would rather answer it in public.',
      'Full post: ' + motdArticleUrl('nobody-calls-to-say-its-dead'),
    ].join('\n\n'),
  },
  {
    id: 'fireside-hangup',
    action: 'fireside',
    title: 'If something about the Skills Economy stops you, what is it?',
    body: [
      'An honest question with no trap in it. I cannot answer an objection nobody says out loud, and some of them are going to be right.',
      'The one I hear most is that it is not a real job, and underneath that, usually: I had a career, I was good at it, and this looks like a step down.',
      'So look at when destitution actually arrives. A person gets educated, gets hired, gets good, gets promoted, and is a productive participant in the global economy by any measure that economy uses. Then it starts. References dry up, the role is restructured, the contract is not renewed, the next interview goes strangely, and it compounds until nothing is coming in.',
      'The destitution arrives after the proof of capability, not instead of it, and it is the same order for almost everybody this happens to. If what they wanted was your work, they would have let you keep the job.',
      'Say your objection under the post. Nobody has to agree with me for it to be worth writing down.',
      'Full post: ' + motdArticleUrl('whats-your-hangup'),
    ].join('\n\n'),
  },
];
