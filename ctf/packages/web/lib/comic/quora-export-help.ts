// Quora's own instructions for requesting a copy of your data, kept in the repo so the knowledge
// library can show them even if Quora's help page moves or disappears.
//
// The whole-export path on `/knowledge` depends on a member being able to get the archive out of
// Quora first, and that step happens entirely on Quora's side where nothing here can help. A link
// alone is not enough: help-center articles get renumbered, and a contributor who lands on a 404 has
// no way to tell whether the process changed or the page merely moved. So the page text is quoted
// verbatim below, with the date it was read, and the link is offered alongside it rather than
// instead of it.
//
// This is a quotation of Quora's published help article, reproduced so members can follow the
// process. Keep it exact — if the article changes, update the text and the `readOn` date together
// rather than paraphrasing.

export const QUORA_DATA_EXPORT_HELP_URL =
  'https://help.quora.com/hc/en-us/articles/360000839503-Can-I-get-a-copy-of-my-data';

export const QUORA_DATA_EXPORT_HELP_TITLE = 'Can I get a copy of my data?';

// The date this repo last read the article, shown next to the quote so a member can judge how old
// it is. Update it whenever the quoted text is checked or changed.
export const QUORA_DATA_EXPORT_HELP_READ_ON = '20 August 2026';

// The article's byline, kept because it is what tells a reader the words are Quora's own.
export const QUORA_DATA_EXPORT_HELP_ATTRIBUTION = 'Official Quora Account';

// The article body, verbatim, one string per paragraph.
export const QUORA_DATA_EXPORT_HELP_PARAGRAPHS: readonly string[] = [
  'Yes. Quora will send an archive of your content and personal data to your account’s primary email address on request. If you would like to request a copy of your data, you may do so by submitting a request via email to privacy@quora.com or by visiting quora.com/contact and selecting "I want a copy of my data"',
  'Please note that you will typically receive the archive within 72 hours of our team confirming that we have received your data request.',
];

// The two addresses named in the quote, pulled out so the FAQ can make them usable without altering
// the quoted text.
export const QUORA_PRIVACY_EMAIL = 'privacy@quora.com';
export const QUORA_CONTACT_URL = 'https://www.quora.com/contact';
