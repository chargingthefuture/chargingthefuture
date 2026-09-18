import { motdArticleUrl, type QuoraMotdMessage } from './types';

// Messages whose ask is the second Peace Battle 2 action: take a slot on TI Radio.
//
// Reading the schedule needs no account; hosting needs an approved one. So these messages ask for
// more than the Fireside ones do, and they are written for somebody who has already decided they
// want to do something rather than somebody arriving for the first time.

export const QUORA_MOTD_TI_RADIO: QuoraMotdMessage[] = [
  {
    id: 'radio-schedule-not-announcement',
    action: 'ti-radio',
    title: 'An announcement points at one time. A schedule holds a week.',
    body: [
      'Survivors host live discussions, and until now the only way to say one was happening was to announce it. An announcement reaches whoever is looking the day it goes out. It cannot hold a schedule, and it cannot let somebody else put themselves on one.',
      'So there is now a page that does both. The day is cut into 90-minute slots — ninety minutes divides a day exactly sixteen times, so every day has the same sixteen starts and nothing drifts — and the grid runs seven days ahead. Each row shows the time, who is hosting, and what it is about. The one happening right now is marked On air.',
      'Every time is printed in your own timezone, and the page names the zone it detected, so nobody is doing arithmetic to work out whether they can make it.',
      'Reading it needs no account at all. Somebody who finds it on a Tuesday can see what is on Thursday.',
      'Take an open time: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('ti-radio'),
    ].join('\n\n'),
  },
  {
    id: 'radio-taken-not-granted',
    action: 'ti-radio',
    title: 'A slot is taken, not granted',
    body: [
      'There is no queue for hosting a discussion on TI Radio, no application, and nobody approving the topic. An approved member presses an open row, writes a line about what it is about, and the slot is theirs. First come, first served.',
      'Their handle and subject then appear on that row for everybody, including people who never sign in.',
      'Because it is taken rather than granted, a name on the schedule is not an endorsement from me. It is somebody who said they would turn up at a particular time.',
      'The limits are plain: three slots in any 24 hours, give one back any time before it starts, and you cannot give it back once it has begun, because by then people have arrived.',
      'The rows are empty until somebody takes one. Take one: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('ti-radio'),
    ].join('\n\n'),
  },
  {
    id: 'radio-not-about-targeting',
    action: 'ti-radio',
    title: 'It does not have to be about being targeted',
    body: [
      'The live discussions on TI Radio can be about anything. Somebody\'s trade. A repair nobody can get done. A book. What you are building. Ninety minutes is a long time to spend on the worst subject in your life, and no one is required to.',
      'Almost every screen in the app is behind approval, and for good reasons. This one is not, because telling somebody to sign up before they can even see when a discussion is happening asks for the thing at the end and gives nothing at the start.',
      'So anybody can open the schedule, link to it, and plan around it. Listening needs no account. Speaking does, because putting your name on a public schedule is a commitment to turn up.',
      'The talking itself happens in Chyme, which keeps its own rooms. TI Radio never records who listened.',
      'Take a time and say what you want to talk about: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('ti-radio'),
    ].join('\n\n'),
  },
  {
    id: 'radio-estonia',
    action: 'ti-radio',
    title: 'Estonia did not get to solve it either',
    body: [
      'The question this community does not answer honestly is what you do if it never stops. Most advice assumes an ending — expose them, sue, wait — which is why it slides off the people who have been in it for decades.',
      'Estonia has 1.3 million people and a much larger neighbor, and it does not get an ending. Its geography is not going to change. It lives anyway. What it built was not a defense that makes the neighbor go away but a country that needs the neighbor for less every year.',
      'In 2007 its banks, government sites and newspapers were offline for weeks. Everybody had a view about where it came from, and no authority ever established it. Survivors will recognize the shape of that.',
      'Saying this is part of life rather than a sentence is cruel if there is nowhere to be a person instead. So the answer here is an economy with hundreds of kinds of work in it, not an argument about attitude.',
      'If you have built something that needs them for less, take ninety minutes and talk about how: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('estonia-did-not-get-to-solve-it-either'),
    ].join('\n\n'),
  },
  {
    id: 'radio-not-secret-society',
    action: 'ti-radio',
    title: 'Secret society is their own brag, and it is wrong by definition',
    body: [
      'A secret society hides its membership and its purpose. These people announce themselves to the person they are working on, constantly, because the signaling is the harassment.',
      'What they are is a control mechanism run by traffickers, with the harassment as its enforcement arm.',
      'The brag does work for them. It tells somebody they are being let into something rather than hired into something. And repeating it inside our own community costs us, because a secret society is unreachable, while a trafficking operation has an economy underneath it that can be declined.',
      'A trafficking operation can be named, counted and declined. Ninety minutes with other people is a good place to work out how.',
      'Take a slot and talk it through: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('they-are-not-a-secret-society'),
    ].join('\n\n'),
  },
  {
    id: 'radio-who-put-you-on-the-list',
    action: 'ti-radio',
    title: 'It does not matter who put you on the list',
    body: [
      'Whoever added you matters up to a point. After that it stops mattering, because every group within reach joins in and runs the same schemes in rotation.',
      'The stories differ by listener — a secret society, a government, a jealous ex — while the methods stay identical. The story is chosen for whoever is being told it. The method does not change.',
      'Build against the method, not the story. A method has parts you can name, count, and plan around. A story has none.',
      'Ninety minutes with other people who have seen the same method is worth more than a year of working out who started it.',
      'Take a slot and name what you have seen: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('who-put-you-on-the-list'),
    ].join('\n\n'),
  },
  {
    id: 'radio-three-people',
    action: 'ti-radio',
    title: 'Two years of writing bought me three people',
    body: [
      'Three Targeted Individuals made a life-changing difference to me. One helped me get a job, and the same person helped me not freeze to death. Another helped me out of the Forced Homecoming scheme. Another gave moral support and helped find other people to start building with.',
      'Direct help, between people. No figure anywhere captures any of it. All three are listed in the Directory, and the listing is what made them findable.',
      'The two years were not the writing. The writing is just the part that left a record. The two years were filtering, by hand: operatives posing as survivors, survivors who did not want to help, survivors who wanted to and could not, and survivors who wanted to and could. Three of them.',
      'Every survivor who goes looking runs that same filter alone, from scratch. A published schedule with your name and your subject on it is the opposite of that filter — it is you being findable on purpose.',
      'Take a slot: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('two-years-to-find-three-people'),
    ].join('\n\n'),
  },
  {
    id: 'radio-pizza',
    action: 'ti-radio',
    title: 'Pizza is not my favorite food',
    body: [
      'Somebody wrote in the Skills Economy space that others say these people read minds and see through your eyes. They do not believe it. Neither do I, and here is what it actually is.',
      'They made me destitute, and destitution left one hot meal I could afford. No stove, so not the cheap pasta everybody recommends — just a particular chain\'s pizza. They decided that was my favorite food.',
      'It is a budget with the options removed, and anybody reading a mind would know the difference.',
      'They are not geniuses and they are not supernatural. The slave trade ran on far less technology with the whole globe taking part. What made me readable was poverty, not carelessness, and options are material rather than a mindset.',
      'Ninety minutes on how somebody got their options back is worth more than another hour on how they do it. Take a slot: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('pizza-is-not-my-favorite-food'),
    ].join('\n\n'),
  },
  {
    id: 'radio-threat-model',
    action: 'ti-radio',
    title: 'Every community has a threat model',
    body: [
      'Objections to a survivor community deserve serious answers. The problem is how they usually arrive: the threat is presented and the other side never is. A person who only hears the first half is not being informed, they are being frightened.',
      'Every community since the beginning of time has had to think about threats — fire, flood, crime, war — and none of them was built by waiting for the threats to end first.',
      'What separates a community that lasts from one that does not has never been the absence of threats. It is the quality of the plan: a threat model, best foot forward, and when something goes wrong you fix what broke and update the next plan.',
      'That is a subject with real content in it, and most of it is held by people who have already had to plan around something.',
      'Take ninety minutes and walk through yours: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('every-community-has-a-threat-model'),
    ].join('\n\n'),
  },
  {
    id: 'radio-audience-larger',
    action: 'ti-radio',
    title: 'The people this needs have already been reached once',
    body: [
      'My goal is 384 approved members working with each other at any given time. On August 24, 2026, the Skills Economy space had 451 all-time follows.',
      'A follow is not a member and not a person on the skills map. It is somebody who saw this and chose to keep seeing it. But 451 is more than 384, which means the number of people the goal needs have already been reached once — not projected from a growth curve.',
      'Every one of those follows was gained while the accounts posting into the space kept being erased. The accounts die, the space stands, and the follows are still there.',
      'What the space cannot do is put anybody in a room with anybody else. A published schedule can.',
      'Take an open time and say what you want to talk about: https://app.chargingthefuture.com/ti-radio',
      'Full post: ' + motdArticleUrl('the-audience-is-already-larger-than-the-goal'),
    ].join('\n\n'),
  },
];
