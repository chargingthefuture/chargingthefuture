// + New in 3.1, shared by web and Android: the Ask form's words and its suggestions, and where an
// Offer or a Story is made. An Ask is posted as a SocketRelay request, public, with no place on it.
export const SE_ASK_WORDS = {
    title: 'Ask',
    intro: 'Ask for something done, found or lent. Anyone in the Avenhood can answer.',
    what: 'What do you need?',
    details: 'A little more',
    hint: 'Everyone can read this. Keep times and places for the private conversation.',
    suggestions: 'Ideas',
    submit: 'Post the ask',
    submitting: 'Posting…',
    posted: 'Posted. It shows on Today, and answers come to Activity.',
    failed: 'Could not post the ask.',
    defaultTag: 'Help',
};
export const SE_OFFER_WORDS = {
    title: 'Offer',
    intro: 'Offer what you have. Each one opens where it is made.',
};
export const SE_STORY_WORDS = {
    title: 'Story',
    intro: 'Lend your own public writing, such as Quora answers, to the Knowledge Library.',
    open: 'Bring your writing',
    href: '/knowledge',
};
export const SE_OFFER_CHOICES = [
    { key: 'place', label: 'A place to stay', text: 'List a room or a place to stay.', href: '/apps/lighthouse' },
    { key: 'hours', label: 'Hours', text: 'Share times you are free. Others pick one in their own timezone.', href: '/apps/mutual-time' },
    { key: 'ride', label: 'A ride', text: 'Drive somebody who needs to get somewhere. Drivers are screened by the community.', href: '/apps/trust-transport' },
    { key: 'skill', label: 'A skill', text: 'Offer a skill, a tool or a repair.', href: '/apps/foundation' },
];
// The holiday asks (44), grouped. Tapping one fills the ask and names its group as the tag.
export const SE_HOLIDAY_ASKS = [
    {
        group: 'Food',
        asks: [
            'Groceries shopped for and delivered',
            'Holiday meal ingredients',
            'Ready-to-eat meals delivered',
            'A food box with easy-to-make items',
            'A grocery gift card',
            'A holiday meal for one',
            'A holiday meal kit for my household',
            'A free community meal nearby',
        ],
    },
    {
        group: 'Getting around',
        asks: [
            'A transit or gas card',
            'A ride to a food pantry',
            'A ride to an appointment',
            'A ride to the pharmacy or grocery store',
            'Prescriptions picked up and delivered',
            'A ride for my child to an activity or community event',
            'Company while I run errands',
        ],
    },
    {
        group: 'Warmth',
        asks: [
            'A warm coat, jacket or snow pants',
            'Hats, gloves, scarves and warm socks',
            'Blankets',
            'Weather-appropriate shoes',
            'Pajamas or winter clothes for my child',
        ],
    },
    {
        group: 'Care',
        asks: [
            'A personal-care kit',
            'Diapers and baby wipes',
            'Formula or baby food',
            'Help with laundry or laundromat costs',
            'A haircut or grooming appointment',
        ],
    },
    { group: 'Home', asks: ['Help carrying groceries or donated items', 'Help moving or setting up household essentials'] },
    {
        group: 'Paperwork and services',
        asks: [
            'Help replacing a lost ID',
            'Help with forms or a benefits application',
            'Help finding local services',
            'A list of nearby meals, shelters, warming centers, clinics and benefits',
            'Help calling an agency or making an appointment',
            'Access to a computer and internet',
            'A place to charge my phone, or a prepaid phone card',
        ],
    },
    {
        group: 'Children',
        asks: [
            'New, age-appropriate toys',
            'Books, art supplies or games for my child',
            'A gift card so I can choose what my children need',
            'School supplies',
            'Help with childcare costs',
            'Trusted childcare for a few hours',
            'A quiet place for my child to do homework',
        ],
    },
    {
        group: 'Company',
        asks: ['An invitation to a low-pressure community gathering', 'A friendly holiday check-in call', 'Ongoing support after the holidays'],
    },
];
// Suggestions for what the member has typed so far: every word they typed appears in the ask. With
// nothing typed, the first of each group.
export function seAskSuggestions(typed, limit = 6) {
    const words = typed.toLowerCase().split(/\s+/).filter((word) => word.length > 1);
    const all = SE_HOLIDAY_ASKS.flatMap((group) => group.asks.map((text) => ({ text, group: group.group })));
    if (words.length === 0)
        return SE_HOLIDAY_ASKS.map((group) => ({ text: group.asks[0], group: group.group })).slice(0, limit);
    return all.filter((item) => words.every((word) => item.text.toLowerCase().includes(word))).slice(0, limit);
}
