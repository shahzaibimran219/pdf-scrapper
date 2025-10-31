/**
 * Calculate the percentage of missing/null fields in resume data
 * Returns a value between 0 and 100
 */
export function calculateMissingDataPercentage(resumeData: any): number {
  if (!resumeData || typeof resumeData !== "object") {
    return 100; // No data at all = 100% missing
  }

  let totalFields = 0;
  let missingFields = 0;

  // Profile fields
  const profile = resumeData.profile ?? {};
  const profileFields = [
    "name", "surname", "email", "headline", "professionalSummary",
    "linkedIn", "website", "country", "city", "relocation", "remote"
  ];
  profileFields.forEach(field => {
    totalFields++;
    const value = profile[field];
    if (value === null || value === undefined || value === "" || 
        (typeof value === "boolean" && value === null)) {
      missingFields++;
    }
  });

  // Work experiences (check if array is empty, or if items have mostly null fields)
  const workExperiences = Array.isArray(resumeData.workExperiences) ? resumeData.workExperiences : [];
  if (workExperiences.length === 0) {
    totalFields += 4; // Count as missing: jobTitle, company, startYear, description
    missingFields += 4;
  } else {
    workExperiences.slice(0, 3).forEach((exp: any) => { // Check first 3 experiences
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
  const educations = Array.isArray(resumeData.educations) ? resumeData.educations : [];
  if (educations.length === 0) {
    totalFields += 3; // school, degree, endYear
    missingFields += 3;
  } else {
    educations.forEach((edu: any) => {
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
  const skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
  totalFields++;
  if (skills.length === 0) {
    missingFields++;
  }

  // Licenses
  const licenses = Array.isArray(resumeData.licenses) ? resumeData.licenses : [];
  totalFields++;
  if (licenses.length === 0) {
    missingFields++;
  }

  // Languages
  const languages = Array.isArray(resumeData.languages) ? resumeData.languages : [];
  totalFields++;
  if (languages.length === 0) {
    missingFields++;
  }

  // Achievements
  const achievements = Array.isArray(resumeData.achievements) ? resumeData.achievements : [];
  totalFields++;
  if (achievements.length === 0) {
    missingFields++;
  }

  // Publications
  const publications = Array.isArray(resumeData.publications) ? resumeData.publications : [];
  totalFields++;
  if (publications.length === 0) {
    missingFields++;
  }

  // Honors
  const honors = Array.isArray(resumeData.honors) ? resumeData.honors : [];
  totalFields++;
  if (honors.length === 0) {
    missingFields++;
  }

  if (totalFields === 0) return 100;
  return Math.round((missingFields / totalFields) * 100);
}

