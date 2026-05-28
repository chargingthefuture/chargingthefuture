import { getFlattened, getHierarchy } from 'lib/skills-taxonomy/repository';
import { SkillsTaxonomyBrowser } from './skills-taxonomy-browser';

type SkillsTaxonomyShellProps = {
  isAdmin: boolean;
};

export async function SkillsTaxonomyShell({ isAdmin }: SkillsTaxonomyShellProps) {
  const [hierarchy, flattened] = await Promise.all([
    getHierarchy(false),
    getFlattened(false, true),
  ]);

  return (
    <SkillsTaxonomyBrowser
      hierarchy={hierarchy}
      totalSkillCount={flattened.length}
      isAdmin={isAdmin}
    />
  );
}
