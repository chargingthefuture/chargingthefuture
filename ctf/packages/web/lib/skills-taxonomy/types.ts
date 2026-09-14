export type TaxonomySector = {
  id: string;
  name: string;
  displayOrder: number;
  workforceShare: number | null;
  isActive: boolean;
  createdAtIso: string;
  updatedAtIso: string;
};

export type TaxonomyJobTitle = {
  id: string;
  sectorId: string;
  name: string;
  displayOrder: number;
  /**
   * Demand weight against the other occupations in the same sector — relative, not a percentage.
   * null means nobody has set one, and the model counts it as 1 so an unweighted sector splits
   * evenly exactly as it always did. Set only through the append-only taxonomy change list.
   */
  workforceShare: number | null;
  isActive: boolean;
  createdAtIso: string;
  updatedAtIso: string;
};

export type TaxonomySkill = {
  id: string;
  jobTitleId: string;
  name: string;
  displayOrder: number;
  aliases: string[];
  isActive: boolean;
  createdAtIso: string;
  updatedAtIso: string;
};

export type TaxonomyHierarchySkill = {
  id: string;
  name: string;
  displayOrder: number;
  aliases: string[];
  isActive: boolean;
};

export type TaxonomyHierarchyJobTitle = {
  id: string;
  name: string;
  displayOrder: number;
  workforceShare: number | null;
  isActive: boolean;
  skills: TaxonomyHierarchySkill[];
};

export type TaxonomyHierarchySector = {
  id: string;
  name: string;
  displayOrder: number;
  workforceShare: number | null;
  isActive: boolean;
  jobTitles: TaxonomyHierarchyJobTitle[];
};

export type TaxonomyFlattenedItem = {
  sectorId: string;
  sectorName: string;
  jobTitleId: string;
  jobTitleName: string;
  skillId: string;
  skillName: string;
  aliases: string[];
  isActive: boolean;
};

export type TaxonomyDependencyTargetType = 'sector' | 'job-title' | 'skill';

export type TaxonomyDependencyImpact = {
  targetType: TaxonomyDependencyTargetType;
  targetId: string;
  reasonRequired: boolean;
  internal: {
    childJobTitles: number;
    childSkills: number;
  };
  external: {
    knownBindings: number;
    pending: boolean;
  };
  canDelete: boolean;
  denyReasons: string[];
};

export type SkillsTaxonomyAuditEvent = {
  pluginId: 'skills-taxonomy';
  command:
    | 'skills-taxonomy.hierarchy.get'
    | 'skills-taxonomy.flattened.get'
    | 'skills-taxonomy.sector.create'
    | 'skills-taxonomy.sector.update'
    | 'skills-taxonomy.sector.delete'
    | 'skills-taxonomy.job-title.create'
    | 'skills-taxonomy.job-title.update'
    | 'skills-taxonomy.job-title.delete'
    | 'skills-taxonomy.skill.create'
    | 'skills-taxonomy.skill.update'
    | 'skills-taxonomy.skill.delete'
    | 'skills-taxonomy.dependency-impact.preview';
  actorId: string;
  status: 'allow' | 'deny';
  reason: string;
  target: Record<string, string | null | undefined>;
  result: 'success' | 'failure';
  errorCategory: string | null;
};
