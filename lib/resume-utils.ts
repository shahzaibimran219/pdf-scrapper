/**
 * Calculate the percentage of missing/null fields in resume data
 * Returns a value between 0 and 100
 */
export function calculateMissingDataPercentage(resumeData: unknown): number {
  if (!resumeData || typeof resumeData !== "object") {
    return 100; // No data at all = 100% missing
  }
  const data = resumeData as Record<string, unknown>;

  let totalFields = 0;
  let missingFields = 0;

  // Profile fields
  const profile = (data.profile as Record<string, unknown> | undefined) ?? {};
  const profileFields = [
    "name", "surname", "email", "headline", "professionalSummary",
    "linkedIn", "website", "country", "city", "relocation", "remote"
  ];
  profileFields.forEach(field => {
    totalFields++;
    const value = profile[field];
    if (value === null || value === undefined || value === "" ) {
      missingFields++;
    }
  });

  // Work experiences (check if array is empty, or if items have mostly null fields)
  const workExperiences = Array.isArray(data.workExperiences) ? (data.workExperiences as unknown[]) : [];
  if (workExperiences.length === 0) {
    totalFields += 4; // Count as missing: jobTitle, company, startYear, description
    missingFields += 4;
  } else {
    workExperiences.slice(0, 3).forEach((expUnknown) => { // Check first 3 experiences
      const exp = (expUnknown ?? {}) as Record<string, unknown>;
      const expFields = ["jobTitle", "company", "startYear", "description"];
      expFields.forEach(field => {
        totalFields++;
        const value = exp?.[field];
        if (value === null || value === undefined || value === "") {
          missingFields++;
        }
      });
    });
  }

  // Educations
  const educations = Array.isArray(data.educations) ? (data.educations as unknown[]) : [];
  if (educations.length === 0) {
    totalFields += 3; // school, degree, endYear
    missingFields += 3;
  } else {
    (educations as unknown[]).forEach((eduUnknown) => {
      const edu = (eduUnknown ?? {}) as Record<string, unknown>;
      const eduFields = ["school", "degree", "endYear"];
      eduFields.forEach(field => {
        totalFields++;
        const value = edu?.[field];
        if (value === null || value === undefined || value === "") {
          missingFields++;
        }
      });
    });
  }

  // Skills (array)
  const skills = Array.isArray(data.skills) ? (data.skills as unknown[]) : [];
  totalFields++;
  if (skills.length === 0) {
    missingFields++;
  }

  // Licenses
  const licenses = Array.isArray(data.licenses) ? (data.licenses as unknown[]) : [];
  totalFields++;
  if (licenses.length === 0) {
    missingFields++;
  }

  // Languages
  const languages = Array.isArray(data.languages) ? (data.languages as unknown[]) : [];
  totalFields++;
  if (languages.length === 0) {
    missingFields++;
  }

  // Achievements
  const achievements = Array.isArray(data.achievements) ? (data.achievements as unknown[]) : [];
  totalFields++;
  if (achievements.length === 0) {
    missingFields++;
  }

  // Publications
  const publications = Array.isArray(data.publications) ? (data.publications as unknown[]) : [];
  totalFields++;
  if (publications.length === 0) {
    missingFields++;
  }

  // Honors
  const honors = Array.isArray(data.honors) ? (data.honors as unknown[]) : [];
  totalFields++;
  if (honors.length === 0) {
    missingFields++;
  }

  if (totalFields === 0) return 100;
  return Math.round((missingFields / totalFields) * 100);
}

