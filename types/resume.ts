/**
 * TypeScript types for Resume data structures
 * These types correspond to the JSON schema defined in lib/schema/resume-json-schema.ts
 */

export interface Profile {
  name?: string | null;
  surname?: string | null;
  headline?: string | null;
  email?: string | null;
  linkedIn?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  relocation?: boolean | null;
  remote?: boolean | null;
  professionalSummary?: string | null;
}

export interface WorkExperience {
  jobTitle?: string | null;
  employmentType?: string | null;
  locationType?: string | null;
  company?: string | null;
  startMonth?: number | null;
  startYear?: number | null;
  endMonth?: number | null;
  endYear?: number | null;
  current?: boolean | null;
  description?: string | null;
}

export interface Education {
  school?: string | null;
  degree?: string | null;
  major?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  current?: boolean | null;
  description?: string | null;
}

export interface License {
  name?: string | null;
  issuer?: string | null;
  issueYear?: number | null;
  description?: string | null;
}

export interface Language {
  language?: string | null;
  level?: string | null;
}

export interface Achievement {
  title?: string | null;
  organization?: string | null;
  achieveDate?: string | null;
  description?: string | null;
}

export interface Publication {
  title?: string | null;
  publisher?: string | null;
  publicationDate?: string | null;
  publicationUrl?: string | null;
  description?: string | null;
}

export interface Honor {
  title?: string | null;
  issuer?: string | null;
  issueMonth?: number | null;
  issueYear?: number | null;
  description?: string | null;
}

export interface ResumeData {
  profile?: Profile;
  workExperiences?: WorkExperience[];
  educations?: Education[];
  skills?: string[];
  licenses?: License[];
  languages?: Language[];
  achievements?: Achievement[];
  publications?: Publication[];
  honors?: Honor[];
}

/**
 * Type for resume list items used in history/dashboard views
 */
export type ResumeListItem = {
  id: string;
  fileName: string;
  uploadedAt: Date;
  fileSize: number | null;
  lastProcessStatus: string | null;
};

