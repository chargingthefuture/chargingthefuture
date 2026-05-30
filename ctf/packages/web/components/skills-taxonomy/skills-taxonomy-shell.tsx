"use client";

import { SkillsTaxonomyBrowser } from "./skills-taxonomy-browser";

type SkillsTaxonomyShellProps = {
  isAdmin: boolean;
};

// The Skills Taxonomy surface is the full-height 3-column browser
// (sectors → job titles → skills) from design/.../survivor-hub/SkillsTaxonomy.tsx.
// Admin management lives on the dedicated /admin/skills-taxonomy route.
export function SkillsTaxonomyShell({ isAdmin }: SkillsTaxonomyShellProps) {
  return <SkillsTaxonomyBrowser isAdmin={isAdmin} />;
}
