// Educational content schema for plugin modules
export interface EducationSection {
  title: string;
  body: string; // markdown
  mediaUrl?: string;
}

export interface EducationContent {
  plugin: string;
  title: string;
  lastUpdated: string;
  sections: EducationSection[];
}
