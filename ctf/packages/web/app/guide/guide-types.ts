// Shape of the generated user guide (guide-content.json). The guide is produced by
// ctf/scripts/generate-user-guide.mjs from each plugin's inventory "Intent and Outcome" statement and
// "User Features" section, plus its test script's "Core smoke" block, rewritten in the project's
// plain voice. The page renders this structure; nothing here is hand-styled per section, so a
// regenerated file drops straight in.

export type GuideSection = {
  // Anchor id for the table-of-contents jump link and the "back to top" return. Kebab-case slug.
  id: string;
  // Display name, e.g. "Directory".
  title: string;
  // Per-section "Last updated" — the date this plugin's source docs (inventory + test script) last
  // changed, as YYYY-MM-DD. Shown next to the section heading so a reader sees how current each part is.
  updated: string;
  // One plain sentence: what this part of the app is for.
  summary: string;
  // A few short, plain paragraphs describing what a member can do here. Grounded in the inventory's
  // user-features section — never a capability the docs do not state.
  body: string[];
  // Optional plain "how to use it" steps, drawn from the test script's core-smoke walkthrough.
  howTo?: string[];
};

export type UserGuide = {
  // Overall "Last updated" for the guide (the most recent section date), YYYY-MM-DD.
  updated: string;
  // Plain intro paragraphs shown above the section list.
  intro: string[];
  // One entry per member-facing plugin, in reading order.
  sections: GuideSection[];
};
