export interface Skill {
  id: string;
  name: string;
}

export interface JobTitle {
  id: string;
  name: string;
  skills: Skill[];
}

export interface Sector {
  id: string;
  name: string;
  jobTitles: JobTitle[];
}
