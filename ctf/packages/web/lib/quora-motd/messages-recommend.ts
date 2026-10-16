import {
  FRONT_PAGE_URL,
  motdArticleUrl,
  SKILLS_HUNT_URL,
  type QuoraMotdMessage,
} from './types';

// Messages whose ask is to recommend one person: who do you know who can help with one named need?
// A name somebody vouches for carries more weight here than any post does, and it still counts
// after the account that asked for it is gone.
//
// Each message names one need from the list on chargingthefuture.com, the needs a visitor taps to
// see how many people in the Directory could help. A need that matches nobody there is recorded in
// directory_unmet_needs, so when the report (`ctf/scripts/sql/landing_unmet_needs_report.sql`)
// shows one need asked for most, the message for that need is the one to edit or add first.
//
// Every fact here is how SkillsHunt and the front page work as shipped: a nomination needs the
// person's Quora profile and a person reviews it, nobody has to be certain, the profile is labeled
// as community-generated and the person can claim it or have it taken down, and the front page
// counts people without showing who they are. If either changes, these change with it.

export const QUORA_MOTD_RECOMMEND: QuoraMotdMessage[] = [
  {
    id: 'recommend-one-name',
    action: 'recommend',
    title: 'Who do you know who can help somebody find work?',
    body: [
      'Not everybody. One person. Somebody who has hired before, runs a crew, or knows which places take people on without asking about the last five years.',
      'A name somebody here vouches for counts for more than anything I could post, and it still counts after this account is gone.',
      'If you have an account, nominate them in SkillsHunt with their Quora profile, and a person reviews it: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('finding-people-earns-credits'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-food',
    action: 'recommend',
    title: 'Who do you know who can help somebody eat this week?',
    body: [
      'A cook, somebody who runs a pantry, somebody who knows which places hand out groceries without a form. One person is enough.',
      'On chargingthefuture.com a visitor taps Food and sees how many people in the Directory could help. Nobody sees who they are, and they do not see who is counted. The count only moves when somebody is added.',
      'If you have an account, nominate the person you thought of in SkillsHunt: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('see-who-could-help-without-an-account'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-someone-to-talk-to',
    action: 'recommend',
    title: 'Who do you know who listens well?',
    body: [
      'Someone to talk to is one of the needs on chargingthefuture.com. It does not take a license. It takes somebody who will hear it out without explaining it away.',
      'You already know who that is for you. Recommend one person.',
      'If you have an account, nominate them in SkillsHunt. You do not have to be certain about them, and a person reviews every nomination: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('see-who-could-help-without-an-account'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-legal',
    action: 'recommend',
    title: 'Who do you know who understands a lease, a court form or a benefits letter?',
    body: [
      'Legal help is one of the needs a visitor can tap on chargingthefuture.com. It does not have to be a lawyer. A paralegal, a court clerk, somebody who has filed their own case and knows the forms.',
      'Who do you know who can do that? One name.',
      'If you have an account, nominate them in SkillsHunt with their Quora profile: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('see-who-could-help-without-an-account'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-housing',
    action: 'recommend',
    title: 'Who do you know who could help somebody find a room?',
    body: [
      'Somebody with a room to rent, somebody who manages a building, somebody who knows which landlords do not run a background check. One person.',
      'Housing is one of the needs on chargingthefuture.com, and a name somebody vouches for is worth more than a listing nobody can check.',
      'If you have an account, nominate them in SkillsHunt: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('see-who-could-help-without-an-account'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-health-care',
    action: 'recommend',
    title: 'Who do you know who works in health care?',
    body: [
      'A nurse, a doctor, a pharmacist, a medical assistant, somebody who knows which clinic takes walk-ins without insurance. Health care is one of the needs on chargingthefuture.com.',
      'Who do you know? One name.',
      'If you have an account, nominate them in SkillsHunt: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('finding-people-earns-credits'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-childcare',
    action: 'recommend',
    title: 'Who do you know who could watch somebody\'s children for an afternoon?',
    body: [
      'A parent who cannot leave the children with anyone cannot get to the interview, the hearing or the appointment. Childcare is one of the needs a visitor can tap on chargingthefuture.com.',
      'Who do you know who has done it, for pay or for family? Recommend one person.',
      'If you have an account, nominate them in SkillsHunt: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('see-who-could-help-without-an-account'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-ride',
    action: 'recommend',
    title: 'Who do you know who can drive?',
    body: [
      'A ride to a shift, to court, to a clinic across town. A ride is one of the needs on chargingthefuture.com, and the person who can give one is often somebody nobody thought to ask.',
      'Who do you know with a car and an afternoon? One name.',
      'If you have an account, nominate them in SkillsHunt: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('see-who-could-help-without-an-account'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-zero-count',
    action: 'recommend',
    title: 'When the count says nobody, the need is written down',
    body: [
      'On chargingthefuture.com a visitor taps what they need and sees how many people in the Directory could help. When the answer is nobody, the page records the need, and nothing about the visitor, so I can go looking for somebody.',
      'You may already know the somebody. Pick one need from the list, a job, food, someone to talk to, legal help, housing, health care, childcare or a ride, and think of one person who can help with it.',
      'If you have an account, nominate them in SkillsHunt: ' + SKILLS_HUNT_URL,
      'If you do not, send them the front page: ' + FRONT_PAGE_URL,
      'Full post: ' + motdArticleUrl('see-who-could-help-without-an-account'),
    ].join('\n\n'),
  },
  {
    id: 'recommend-listed-not-signed-up',
    action: 'recommend',
    title: 'Being in the Directory costs nobody an account',
    body: [
      'Most people in the Directory were added by somebody else, from what they said about themselves in public. Each of those profiles is labeled as community-generated, and the person can claim it or have it taken down at any time.',
      'So recommending somebody does not sign them up for anything. It makes them findable by the people who need what they can do.',
      'Who do you know? If you have an account, nominate one person in SkillsHunt: ' + SKILLS_HUNT_URL,
      'If you do not, send them this post.',
      'Full post: ' + motdArticleUrl('finding-people-earns-credits'),
    ].join('\n\n'),
  },
];
