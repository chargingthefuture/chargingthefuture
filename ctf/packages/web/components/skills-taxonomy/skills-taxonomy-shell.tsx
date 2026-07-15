"use client";

import { SkillsTaxonomyBrowser } from "./skills-taxonomy-browser";

// The Skills Taxonomy surface is the full-height 3-column browser
// (sectors → job titles → skills) from design/.../survivor-hub/SkillsTaxonomy.tsx.
// Read-only: it browses the taxonomy; there is no in-app taxonomy editor.
export function SkillsTaxonomyShell() {
  return <SkillsTaxonomyBrowser />;
}
